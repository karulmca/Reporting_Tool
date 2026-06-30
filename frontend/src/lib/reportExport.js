// Rich status reports for the Graphs & Progress page: a printable PDF (KPIs +
// per-POD table + chart images) and an Excel workbook with the chart images
// embedded (via ExcelJS, which the community xlsx build can't do).
import ExcelJS from 'exceljs'
import ApexCharts from 'apexcharts'
import { implCount, progCount, memberName, STATUS_COL } from './helpers'

const STATUSES = ['Implemented', 'In Progress', 'POC Stage', 'Proposed', 'New', 'Ideation']

// Charts rendered on the Graphs page (chart.id -> friendly title).
export const CHART_SPECS = [
  { id: 'g-velocity', title: 'Sprint Velocity' },
  { id: 'g-burn', title: 'Burn-up & Forecast' },
  { id: 'g-gauge', title: 'Idea Target Attainment' },
  { id: 'g-status', title: 'Ideas by Status' },
  { id: 'g-pod', title: 'Ideas by POD' },
  { id: 'g-memberprog', title: 'Member Progress (Implemented vs Target)' },
  { id: 'g-targetactual', title: 'Target vs Actual by POD' },
]

// Grab each mounted chart as a PNG data-URI (scale 2). Unmounted/unknown charts
// are skipped. Must run while the Graphs page is on screen.
export async function captureCharts(specs = CHART_SPECS) {
  const out = []
  for (const s of specs) {
    try {
      const res = await ApexCharts.exec(s.id, 'dataURI', { scale: 2 })
      if (res && res.imgURI) out.push({ ...s, imgURI: res.imgURI })
    } catch { /* chart not ready */ }
  }
  return out
}

// Build the same status model the dashboard Excel uses (overall + per-POD).
export function statusModel(data) {
  const { members, ideas, pods } = data
  const courses = (data.training && data.training.courses) || []
  const tstatus = (data.training && data.training.status) || {}
  const statusOpts = (data.training && data.training.statusOptions) || []
  // status label -> ARGB colour (for the training matrix heat-map).
  const statusColors = {}
  statusOpts.forEach((o) => { if (o.label && o.color) statusColors[o.label] = 'FF' + String(o.color).replace('#', '').toUpperCase().padStart(6, '0').slice(-6) })
  const podCodes = new Set(pods.map((p) => p.code))
  const idsOf = (mem) => new Set(mem.map((m) => m.id))
  const ideasOf = (ids) => ideas.filter((i) => ids.has(i.submitter))
  const counts = (list) => STATUSES.map((st) => list.filter((i) => i.status === st).length)
  const savAmt = (i) => Number(i.savings_amount) || 0
  const savings = (list) => ({
    hard: list.reduce((a, i) => a + (i.savings_type === 'Hard Dollar' ? savAmt(i) : 0), 0),
    soft: list.reduce((a, i) => a + (i.savings_type === 'Soft Dollar' ? savAmt(i) : 0), 0),
    total: list.reduce((a, i) => a + savAmt(i), 0),
  })
  const trainingPct = (mem) => {
    const cells = mem.length * courses.length
    if (!cells) return 0
    const done = courses.reduce((a, c) => a + mem.filter((m) => (tstatus[m.id] || {})[c.id] === 'Completed').length, 0)
    return Math.round((done / cells) * 100)
  }
  const row = (label, name, mem, list) => {
    const c = counts(list)
    const s = savings(list)
    const target = mem.reduce((a, m) => a + (m.target || 0), 0)
    return [label, name, mem.length, list.length, ...c, s.hard, s.soft, s.total, target, target - c[0], target ? Math.round((c[0] / target) * 100) : 0, trainingPct(mem)]
  }

  const header = ['POD', 'Name', 'Members', 'Total Ideas', ...STATUSES, 'Hard $', 'Soft $', 'Total $', 'Target', 'Gap', 'Attainment %', 'Training %']
  const overallRows = pods.map((p) => { const mem = members.filter((m) => m.pod === p.code); return row(p.code, p.name, mem, ideasOf(idsOf(mem))) })
  const mappedIds = new Set(members.filter((m) => m.pod && podCodes.has(m.pod)).map((m) => m.id))
  const unmappedMem = members.filter((m) => !(m.pod && podCodes.has(m.pod)))
  const unmappedIdeas = ideas.filter((i) => !mappedIds.has(i.submitter))
  if (unmappedIdeas.length || unmappedMem.length) overallRows.push(row('(Unmapped)', 'Submitter not in a POD', unmappedMem, unmappedIdeas))
  overallRows.push(row('TOTAL', 'All PODs', members, ideas))

  const perPod = pods.map((p) => {
    const mem = members.filter((m) => m.pod === p.code).slice().sort((a, b) => a.name.localeCompare(b.name))
    const pIdeas = ideasOf(idsOf(mem))
    const impl = pIdeas.filter((i) => i.status === 'Implemented').length
    const target = mem.reduce((a, m) => a + (m.target || 0), 0)
    return {
      code: p.code, name: p.name,
      summary: [['Members', mem.length], ['Total Ideas', pIdeas.length], ['Implemented', impl],
        ['In Progress', pIdeas.filter((i) => i.status === 'In Progress').length], ['Target', target],
        ['Gap', target - impl], ['Attainment %', target ? Math.round((impl / target) * 100) : 0], ['Training %', trainingPct(mem)]],
      memberHeader: ['Name', 'Emp ID', 'Target', 'Submitted', 'Implemented', 'In Progress', 'Gap', 'Attainment %'],
      memberRows: mem.map((m) => {
        const d = implCount(ideas, m.id)
        const sub = ideas.filter((i) => i.submitter === m.id).length
        return [m.name, m.id, m.target, sub, d, progCount(ideas, m.id), m.target - d, m.target ? Math.round((d / m.target) * 100) : 0]
      }),
      ideaHeader: ['Idea ID', 'Title', 'Status', 'Stage', 'Saving Type', 'Savings $', 'Workflow', 'Submitter', 'Comments'],
      ideaRows: pIdeas.map((i) => [i.idea_id, i.title, i.status, i.stage, i.savings_type || '', savAmt(i), i.workflow, memberName(members, i.submitter), i.comments || '']),
      trainingHeader: ['Member', 'Emp ID', ...courses.map((c) => c.name || c.id), 'Completed %'],
      trainingRows: mem.map((m) => {
        const st = tstatus[m.id] || {}
        const statuses = courses.map((c) => st[c.id] || '-')
        const done = courses.filter((c) => st[c.id] === 'Completed').length
        return [m.name, m.id, ...statuses, courses.length ? Math.round((done / courses.length) * 100) : 0]
      }),
    }
  })

  const impl = ideas.filter((i) => i.status === 'Implemented').length
  const totalTarget = members.reduce((a, m) => a + (m.target || 0), 0)
  const sv = savings(ideas)
  const kpis = {
    Ideas: ideas.length, Implemented: impl, 'In Progress': ideas.filter((i) => i.status === 'In Progress').length,
    Target: totalTarget, 'Attainment %': totalTarget ? Math.round((impl / totalTarget) * 100) : 0, Members: members.length,
    'Hard $': sv.hard, 'Soft $': sv.soft, 'Savings $': sv.total,
  }
  return { header, overallRows, perPod, kpis, statusColors, courseCount: courses.length }
}

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Printable PDF (opens a print window). Capture charts first, then call this.
export function exportReportPDF(data, charts) {
  const { header, overallRows, kpis } = statusModel(data)
  const win = window.open('', '_blank')
  if (!win) return
  const kpiCards = Object.entries(kpis).map(([k, v]) =>
    `<div class="m"><div class="mv">${v}</div><div class="ml">${esc(k)}</div></div>`).join('')
  const thead = '<tr>' + header.map((h) => `<th>${esc(h)}</th>`).join('') + '</tr>'
  const tbody = overallRows.map((r) => '<tr>' + r.map((c, i) => `<td${i >= 2 ? ' class="num"' : ''}>${esc(c)}</td>`).join('') + '</tr>').join('')
  const chartImgs = (charts || []).map((c) =>
    `<div class="ch"><div class="ct">${esc(c.title)}</div><img src="${c.imgURI}" /></div>`).join('')
  win.document.write(
    '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>BlueBolt Status Report</title><style>'
    + 'body{font-family:Segoe UI,Arial,sans-serif;font-size:12px;color:#111;padding:32px}'
    + 'h1{font-size:22px;margin:0 0 2px}.sub{color:#666;font-size:12px;margin-bottom:18px}'
    + '.metrics{display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap}.m{background:#f5f7fa;border-radius:8px;padding:10px 16px;min-width:96px}'
    + '.mv{font-size:22px;font-weight:700;color:#1d4ed8}.ml{font-size:10px;color:#888;text-transform:uppercase;margin-top:3px}'
    + 'h2{font-size:14px;margin:18px 0 8px}table{width:100%;border-collapse:collapse;margin-bottom:8px}'
    + 'th{background:#f5f7fa;font-size:10px;text-transform:uppercase;color:#555;padding:7px 8px;text-align:left;border-bottom:1px solid #e5e7eb}'
    + 'td{padding:6px 8px;border-bottom:1px solid #eee;font-size:11px}td.num{text-align:right;font-variant-numeric:tabular-nums}'
    + 'tr:last-child td{font-weight:700;background:#fafbfc}'
    + '.charts{display:flex;flex-wrap:wrap;gap:16px;margin-top:8px}.ch{width:48%;page-break-inside:avoid}'
    + '.ct{font-size:11px;font-weight:600;color:#444;margin-bottom:4px}.ch img{width:100%;border:1px solid #eee;border-radius:6px}'
    + '.footer{margin-top:24px;font-size:10px;color:#aaa;border-top:1px solid #eee;padding-top:8px}'
    + '@media print{.ch{width:48%}}</style></head><body>'
    + '<h1>BlueBolt — Status Report</h1>'
    + '<div class="sub">Generated ' + esc(new Date().toLocaleString('en-IN')) + '</div>'
    + '<div class="metrics">' + kpiCards + '</div>'
    + '<h2>POD Status</h2><table><thead>' + thead + '</thead><tbody>' + tbody + '</tbody></table>'
    + (chartImgs ? '<h2>Charts</h2><div class="charts">' + chartImgs + '</div>' : '')
    + '<div class="footer">BlueBolt Innovation Tracker</div></body></html>',
  )
  win.document.close()
  win.focus()
  setTimeout(() => win.print(), 600)
}

function safeSheet(used, raw) {
  let name = String(raw || 'POD').replace(/[:\\/?*[\]]/g, ' ').trim().slice(0, 31) || 'POD'
  const base = name; let n = 1
  while (used.has(name.toLowerCase())) { const sfx = ' (' + (++n) + ')'; name = base.slice(0, 31 - sfx.length) + sfx }
  used.add(name.toLowerCase())
  return name
}

// ---- Excel styling helpers -------------------------------------------------
const XC = {
  brand: 'FF1D4ED8', head: 'FF1E3A8A', headTxt: 'FFFFFFFF', section: 'FFE8EFFC',
  total: 'FFFFF4D6', unmapped: 'FFF1F5F9', zebra: 'FFF6F9FD', border: 'FFE2E8F0', muted: 'FF64748B',
}
const THIN = { style: 'thin', color: { argb: XC.border } }
const BOX = { top: THIN, left: THIN, bottom: THIN, right: THIN }
const POD_TABS = ['FF2563EB', 'FF16A34A', 'FFF59E0B', 'FF8B5CF6', 'FF14B8A6', 'FFEF4444', 'FFF97316', 'FFEC4899']

function styleHeaderRow(row) {
  row.height = 22
  row.eachCell((c) => {
    c.font = { bold: true, color: { argb: XC.headTxt }, size: 11 }
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XC.head } }
    c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    c.border = BOX
  })
}
function styleDataRow(row, idx, pctCols = [], dollarCols = []) {
  row.eachCell((c, col) => {
    c.border = BOX
    if (idx % 2) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XC.zebra } }
    c.alignment = { vertical: 'middle', horizontal: typeof c.value === 'number' ? 'center' : 'left' }
    if (pctCols.includes(col)) c.numFmt = '0"%"'
    if (dollarCols.includes(col)) c.numFmt = '$#,##0'
  })
}
function titleRow(ws, text, span) {
  const r = ws.addRow([text]); ws.mergeCells(r.number, 1, r.number, span)
  const c = ws.getCell(r.number, 1)
  c.font = { bold: true, size: 16, color: { argb: XC.brand } }
  c.alignment = { vertical: 'middle' }; r.height = 26
  return r
}
function sectionRow(ws, text, span) {
  const r = ws.addRow([text]); ws.mergeCells(r.number, 1, r.number, span)
  const c = ws.getCell(r.number, 1)
  c.font = { bold: true, size: 12, color: { argb: XC.head } }
  c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XC.section } }
  r.height = 20
  return r
}
const pctColsOf = (header) => header.map((h, i) => (/%/.test(h) ? i + 1 : 0)).filter(Boolean)
const dollarColsOf = (header) => header.map((h, i) => (/\$/.test(h) ? i + 1 : 0)).filter(Boolean)
const KPI_COLORS = ['FF1D4ED8', 'FF16A34A', 'FF0EA5E9', 'FF7C3AED', 'FFF59E0B', 'FF334155']
function numToCol(n) { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26) } return s }
// A green→amber→red 3-colour scale on a percentage column range.
function pctColorScale(ws, colNum, firstRow, lastRow) {
  if (lastRow < firstRow) return
  const L = numToCol(colNum)
  ws.addConditionalFormatting({
    ref: `${L}${firstRow}:${L}${lastRow}`,
    rules: [{
      type: 'colorScale',
      cfvo: [{ type: 'num', value: 0 }, { type: 'num', value: 50 }, { type: 'num', value: 100 }],
      color: [{ argb: 'FFF8696B' }, { argb: 'FFFFD666' }, { argb: 'FF63BE7B' }],
    }],
  })
}
// A row of KPI "cards" (value over label), each spanning two columns.
function kpiCards(ws, kpis) {
  const entries = Object.entries(kpis)
  const valRow = ws.addRow([]); const labRow = ws.addRow([])
  valRow.height = 30; labRow.height = 18
  entries.forEach(([label, val], i) => {
    const c0 = i * 2 + 1
    ws.mergeCells(valRow.number, c0, valRow.number, c0 + 1)
    ws.mergeCells(labRow.number, c0, labRow.number, c0 + 1)
    const v = ws.getCell(valRow.number, c0)
    v.value = val; if (/%/.test(label)) v.numFmt = '0"%"'; else if (/\$/.test(label)) v.numFmt = '$#,##0'
    v.font = { bold: true, size: 18, color: { argb: KPI_COLORS[i % KPI_COLORS.length] } }
    v.alignment = { vertical: 'middle', horizontal: 'center' }
    v.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }
    v.border = { top: THIN, left: THIN, right: THIN }
    const l = ws.getCell(labRow.number, c0)
    l.value = String(label).toUpperCase()
    l.font = { bold: true, size: 9, color: { argb: XC.muted } }
    l.alignment = { vertical: 'middle', horizontal: 'center' }
    l.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }
    l.border = { left: THIN, right: THIN, bottom: THIN }
  })
}

// Excel workbook (ExcelJS): styled Overall sheet with the status table + embedded
// chart images, then one styled sheet per POD (summary / members / ideas).
export async function exportReportExcel(data, charts, opts = {}) {
  const { header, overallRows, perPod, kpis, statusColors, courseCount } = statusModel(data)
  const scopeLabel = (opts.scopeLabel || '').trim()
  const wb = new ExcelJS.Workbook()
  wb.created = new Date()
  const used = new Set()
  const span = header.length
  const pcts = pctColsOf(header)

  // --- Overall sheet -------------------------------------------------------
  const ws = wb.addWorksheet(safeSheet(used, 'Overall'), { views: [{ showGridLines: false }] })

  // Brand banner
  const t = ws.addRow(['BlueBolt — Innovation Status Report'])
  ws.mergeCells(t.number, 1, t.number, span)
  const tc = ws.getCell(t.number, 1)
  tc.font = { bold: true, size: 18, color: { argb: XC.headTxt } }
  tc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XC.head } }
  tc.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
  t.height = 36
  const sub = ws.addRow(['Generated ' + new Date().toLocaleString('en-IN') + (scopeLabel ? '   ·   Scope: ' + scopeLabel : '')])
  ws.mergeCells(sub.number, 1, sub.number, span)
  sub.getCell(1).font = { italic: true, color: { argb: XC.muted } }
  sub.getCell(1).alignment = { horizontal: 'left', indent: 1 }
  ws.addRow([])

  // KPI cards
  kpiCards(ws, kpis)
  ws.addRow([])

  // Status table
  const hRow = ws.addRow(header); styleHeaderRow(hRow)
  const firstData = hRow.number + 1
  overallRows.forEach((r, idx) => {
    const rr = ws.addRow(r)
    styleDataRow(rr, idx, pcts)
    const special = r[0] === 'TOTAL' ? XC.total : r[0] === '(Unmapped)' ? XC.unmapped : null
    if (special) rr.eachCell((c, col) => {
      c.font = { bold: true }
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: special } }
      c.border = BOX
      if (pcts.includes(col)) c.numFmt = '0"%"'
    })
  })
  const lastData = ws.rowCount
  header.forEach((h, i) => { ws.getColumn(i + 1).width = i === 0 ? 13 : i === 1 ? 26 : Math.max(11, h.length + 2) })
  ws.views = [{ state: 'frozen', ySplit: hRow.number, showGridLines: false }]
  ws.autoFilter = { from: { row: hRow.number, column: 1 }, to: { row: hRow.number, column: span } }
  pcts.forEach((col) => pctColorScale(ws, col, firstData, lastData))

  // Embedded charts, stacked below the table.
  if (charts && charts.length) {
    let row = ws.rowCount + 2
    sectionRow(ws, 'Charts', span); row += 1
    for (const c of charts) {
      const label = ws.getCell(`A${row}`)
      label.value = c.title; label.font = { bold: true, color: { argb: XC.head } }
      const b64 = String(c.imgURI).split(',')[1] || c.imgURI
      const imgId = wb.addImage({ base64: b64, extension: 'png' })
      ws.addImage(imgId, { tl: { col: 0, row }, ext: { width: 560, height: 320 } })
      row += 18
    }
  }

  // --- One sheet per POD ---------------------------------------------------
  perPod.forEach((p, pi) => {
    const s = wb.addWorksheet(safeSheet(used, p.code || p.name), { views: [{ showGridLines: false }] })
    s.properties.tabColor = { argb: POD_TABS[pi % POD_TABS.length] }
    // Banner
    const bt = s.addRow([`${p.code} — ${p.name}`])
    s.mergeCells(bt.number, 1, bt.number, 7)
    const btc = s.getCell(bt.number, 1)
    btc.font = { bold: true, size: 15, color: { argb: XC.headTxt } }
    btc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: POD_TABS[pi % POD_TABS.length] } }
    btc.alignment = { vertical: 'middle', indent: 1 }; bt.height = 28
    s.addRow([])
    // KPI cards from this POD's summary (first 6 metrics)
    const podKpis = Object.fromEntries(p.summary.slice(0, 6))
    kpiCards(s, podKpis)
    s.addRow([])
    sectionRow(s, 'MEMBERS', p.memberHeader.length)
    styleHeaderRow(s.addRow(p.memberHeader))
    const mFirst = s.rowCount + 1
    p.memberRows.forEach((r, idx) => styleDataRow(s.addRow(r), idx, [p.memberHeader.length]))
    pctColorScale(s, p.memberHeader.length, mFirst, s.rowCount) // Attainment % = last col
    s.addRow([])
    sectionRow(s, 'IDEAS', p.ideaHeader.length)
    styleHeaderRow(s.addRow(p.ideaHeader))
    p.ideaRows.forEach((r, idx) => styleDataRow(s.addRow(r), idx))

    // TRAINING matrix (members × courses), status cells colour-coded.
    if (courseCount > 0) {
      s.addRow([])
      sectionRow(s, 'TRAINING', p.trainingHeader.length)
      styleHeaderRow(s.addRow(p.trainingHeader))
      const tFirst = s.rowCount + 1
      const lastCol = p.trainingHeader.length
      p.trainingRows.forEach((r, idx) => {
        const rr = s.addRow(r)
        styleDataRow(rr, idx, [lastCol])
        // Colour the course-status cells (cols 3 .. lastCol-1) by their status.
        for (let col = 3; col < lastCol; col++) {
          const cell = rr.getCell(col)
          const argb = statusColors[cell.value]
          if (argb) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } }
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
            cell.alignment = { vertical: 'middle', horizontal: 'center' }
          } else {
            cell.alignment = { vertical: 'middle', horizontal: 'center' }
          }
        }
      })
      pctColorScale(s, lastCol, tFirst, s.rowCount) // Completed %
    }

    // Column widths (cover the widest of the three tables).
    const maxCols = Math.max(p.memberHeader.length, p.ideaHeader.length, p.trainingHeader.length, 7)
    for (let i = 1; i <= maxCols; i++) s.getColumn(i).width = i === 1 ? 26 : i === 2 ? 30 : 15
  })

  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'BlueBolt_Status_Report' + (scopeLabel ? '_' + scopeLabel.replace(/[^A-Za-z0-9]+/g, '_') : '') + '.xlsx'
  a.click()
  URL.revokeObjectURL(a.href)
}

// ---- Off-screen charts (for pages without mounted charts, e.g. Dashboard) --
// Print-friendly base: white background, dark text — looks right in Excel/print.
const PRINT = {
  chart: { background: '#ffffff', toolbar: { show: false }, fontFamily: 'Inter, Arial, sans-serif', foreColor: '#334155' },
  grid: { borderColor: '#eef2f7' },
  dataLabels: { enabled: false },
  legend: { position: 'top', labels: { colors: '#334155' }, fontSize: '12px' },
  tooltip: { enabled: false },
  stroke: { width: 1, colors: ['#fff'] },
}

// Build a self-contained set of overall (all-POD) charts from the data.
export function buildDashboardReportCharts(data) {
  const { members, ideas, pods } = data
  const courses = (data.training && data.training.courses) || []
  const tstatus = (data.training && data.training.status) || {}
  const STAT = ['Implemented', 'In Progress', 'POC Stage', 'Proposed', 'New', 'Ideation']
  const codes = pods.map((p) => p.code)
  const podMemIds = (code) => new Set(members.filter((m) => m.pod === code).map((m) => m.id))
  const perPod = (fn) => pods.map((p) => fn(podMemIds(p.code), p))

  const statusCount = STAT.map((s) => ideas.filter((i) => i.status === s).length)
  const totalByPod = perPod((ids) => ideas.filter((i) => ids.has(i.submitter)).length)
  const implByPod = perPod((ids) => ideas.filter((i) => ids.has(i.submitter) && i.status === 'Implemented').length)
  const targetByPod = perPod((ids, p) => members.filter((m) => m.pod === p.code).reduce((a, m) => a + (m.target || 0), 0))
  const trainByPod = perPod((ids, p) => {
    const mem = members.filter((m) => m.pod === p.code)
    const cells = mem.length * courses.length
    if (!cells) return 0
    const done = courses.reduce((a, c) => a + mem.filter((m) => (tstatus[m.id] || {})[c.id] === 'Completed').length, 0)
    return Math.round((done / cells) * 100)
  })

  const bar = { plotOptions: { bar: { columnWidth: '55%', borderRadius: 3 } } }
  const charts = [
    {
      id: 'r-status', title: 'Ideas by Status', type: 'donut', series: statusCount,
      options: { ...PRINT, labels: STAT, colors: STAT.map((s) => STATUS_COL[s] || '#94a3b8'), dataLabels: { enabled: true }, legend: { ...PRINT.legend, position: 'right' } },
    },
    {
      id: 'r-pod', title: 'Ideas by POD (Total vs Implemented)', type: 'bar',
      series: [{ name: 'Total', data: totalByPod }, { name: 'Implemented', data: implByPod }],
      options: { ...PRINT, ...bar, colors: ['#3b82f6', '#22c55e'], xaxis: { categories: codes } },
    },
    {
      id: 'r-target', title: 'Implemented vs Target by POD', type: 'bar',
      series: [{ name: 'Implemented', data: implByPod }, { name: 'Target', data: targetByPod }],
      options: { ...PRINT, ...bar, colors: ['#22c55e', '#cbd5e1'], xaxis: { categories: codes } },
    },
  ]
  if (courses.length) charts.push({
    id: 'r-train', title: 'Training Completion % by POD', type: 'bar',
    series: [{ name: 'Training %', data: trainByPod }],
    options: { ...PRINT, ...bar, colors: ['#8b5cf6'], xaxis: { categories: codes }, yaxis: { max: 100 } },
  })
  return charts
}

// Render chart configs into PNG data-URIs without needing them on the page.
export async function renderChartsOffscreen(configs, { width = 620, height = 340 } = {}) {
  const host = document.createElement('div')
  host.style.cssText = `position:fixed;left:-10000px;top:0;width:${width}px;background:#fff`
  document.body.appendChild(host)
  const out = []
  try {
    for (const c of configs) {
      const el = document.createElement('div')
      el.style.cssText = `width:${width}px;height:${height}px;background:#fff`
      host.appendChild(el)
      const options = { ...c.options, chart: { ...(c.options.chart || {}), type: c.type, width, height, animations: { enabled: false }, redrawOnParentResize: false } }
      const chart = new ApexCharts(el, { ...options, series: c.series })
      try {
        await chart.render()
        const r = await chart.dataURI({ scale: 2 })
        if (r && r.imgURI) out.push({ id: c.id, title: c.title, imgURI: r.imgURI })
      } catch { /* skip a chart that fails to render */ }
      chart.destroy()
      host.removeChild(el)
    }
  } finally {
    document.body.removeChild(host)
  }
  return out
}

// Dashboard report: render overall charts off-screen, then build the workbook.
export async function exportDashboardReportExcel(data, opts = {}) {
  const charts = await renderChartsOffscreen(buildDashboardReportCharts(data))
  await exportReportExcel(data, charts, opts)
}

// ---- Scrum board export ----------------------------------------------------
// Charts driven by Story Points and Work Effort across the current board items.
function buildBoardCharts({ items, columns, members, types, effortOf, hasEffort }) {
  const bar = { plotOptions: { bar: { columnWidth: '55%', borderRadius: 3 } } }
  const sumBy = (list, fn) => list.reduce((a, i) => a + fn(i), 0)
  // by state
  const cols = columns.slice().sort((a, b) => a.sort - b.sort)
  const spByState = cols.map((c) => sumBy(items.filter((i) => i.column_id === c.id), (i) => i.story_points || 0))
  const efByState = cols.map((c) => sumBy(items.filter((i) => i.column_id === c.id), effortOf))
  // by assignee
  const assignees = [...new Set(items.map((i) => i.assignee || ''))]
  const aName = (id) => { if (!id) return 'Unassigned'; const m = members.find((x) => x.id === id); return m ? m.name : id }
  const spByA = assignees.map((a) => sumBy(items.filter((i) => (i.assignee || '') === a), (i) => i.story_points || 0))
  const efByA = assignees.map((a) => sumBy(items.filter((i) => (i.assignee || '') === a), effortOf))

  const charts = [
    {
      id: 'b-state', title: 'Story Points' + (hasEffort ? ' & Work Effort' : '') + ' by State', type: 'bar',
      series: [{ name: 'Story Points', data: spByState }].concat(hasEffort ? [{ name: 'Work Effort', data: efByState }] : []),
      options: { ...PRINT, ...bar, colors: ['#3b82f6', '#f59e0b'], xaxis: { categories: cols.map((c) => c.name) }, dataLabels: { enabled: true } },
    },
    {
      id: 'b-assignee', title: 'Story Points' + (hasEffort ? ' & Work Effort' : '') + ' by Assignee', type: 'bar',
      series: [{ name: 'Story Points', data: spByA }].concat(hasEffort ? [{ name: 'Work Effort', data: efByA }] : []),
      options: { ...PRINT, ...bar, colors: ['#3b82f6', '#f59e0b'], xaxis: { categories: assignees.map(aName) } },
    },
  ]
  const typeCounts = types.map((t) => items.filter((i) => i.type_id === t.id).length)
  if (typeCounts.some((c) => c > 0)) charts.push({
    id: 'b-type', title: 'Items by Type', type: 'donut',
    series: typeCounts, options: { ...PRINT, labels: types.map((t) => t.name), colors: types.map((t) => t.color || '#94a3b8'), dataLabels: { enabled: true }, legend: { ...PRINT.legend, position: 'right' } },
  })
  return charts
}

// Extract the leading ADO ID from a title like "1565075 - description".
const adoId = (title) => { const m = /^\s*(\d+)/.exec(title || ''); return m ? m[1] : '' }
// Drop duplicate work items that share the same ADO ID (keep the first seen).
function dedupeByAdo(items) {
  const seen = new Set(); const out = []
  for (const it of items) {
    const ado = adoId(it.title)
    if (ado) { if (seen.has(ado)) continue; seen.add(ado) }
    out.push(it)
  }
  return out
}

export async function exportBoardExcel({ items, columns, types, members, wiFields, framework, sprint, pod }) {
  items = dedupeByAdo(items)
  const typeName = (id) => { const t = types.find((x) => x.id === id); return t ? t.name : '—' }
  const colName = (id) => { const c = columns.find((x) => x.id === id); return c ? c.name : '—' }
  const mName = (id) => { const m = members.find((x) => x.id === id); return m ? m.name : (id || 'Unassigned') }
  const effortField = (wiFields || []).find((f) => /effort/i.test(f.label))
  const hasEffort = !!effortField
  const effortOf = (it) => (hasEffort ? (parseFloat((it.custom || {})[effortField.id]) || 0) : 0)
  const doneCols = new Set(columns.filter((c) => c.is_done).map((c) => c.id))
  const order = Object.fromEntries(columns.map((c) => [c.id, c.sort]))

  const charts = await renderChartsOffscreen(buildBoardCharts({ items, columns, members, types, effortOf, hasEffort }))

  const wb = new ExcelJS.Workbook(); wb.created = new Date()
  const header = ['ID', 'ADO ID', 'Title', 'Type', 'State', 'Assignee', 'Priority', 'Story Points']
    .concat(hasEffort ? ['Work Effort'] : []).concat(['Tags', 'Updates'])
  const span = header.length
  const ws = wb.addWorksheet('Board', { views: [{ showGridLines: false }] })

  // banner + subtitle
  const t = ws.addRow([`Scrum Board — ${pod || 'All PODs'}${framework ? ' · ' + framework.name : ''}${sprint ? ' · ' + sprint : ''}`])
  ws.mergeCells(t.number, 1, t.number, span)
  const tc = ws.getCell(t.number, 1)
  tc.font = { bold: true, size: 16, color: { argb: XC.headTxt } }
  tc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XC.head } }
  tc.alignment = { vertical: 'middle', indent: 1 }; t.height = 32
  const sub = ws.addRow(['Generated ' + new Date().toLocaleString('en-IN')])
  ws.mergeCells(sub.number, 1, sub.number, span)
  sub.getCell(1).font = { italic: true, color: { argb: XC.muted } }
  ws.addRow([])

  // KPI cards
  const totalSP = items.reduce((a, i) => a + (i.story_points || 0), 0)
  const totalEffort = items.reduce((a, i) => a + effortOf(i), 0)
  const kpis = { Items: items.length, 'Story Points': totalSP }
  if (hasEffort) kpis['Work Effort'] = totalEffort
  kpis.Done = items.filter((i) => doneCols.has(i.column_id)).length
  kpiCards(ws, kpis); ws.addRow([])

  // items table
  const hRow = ws.addRow(header); styleHeaderRow(hRow)
  const sorted = items.slice().sort((a, b) => (order[a.column_id] || 0) - (order[b.column_id] || 0) || a.rank - b.rank)
  sorted.forEach((it, idx) => {
    const row = [it.id, adoId(it.title), it.title, typeName(it.type_id), colName(it.column_id), mName(it.assignee), it.priority, it.story_points || 0]
      .concat(hasEffort ? [effortOf(it)] : []).concat([it.tags || '', it.updates_count || 0])
    styleDataRow(ws.addRow(row), idx)
  })
  const widths = [6, 12, 40, 14, 14, 20, 10, 12].concat(hasEffort ? [12] : []).concat([22, 9])
  widths.forEach((w, i) => { ws.getColumn(i + 1).width = w })
  ws.views = [{ state: 'frozen', ySplit: hRow.number, showGridLines: false }]

  // charts
  if (charts.length) {
    let r = ws.rowCount + 2
    sectionRow(ws, 'Charts', span); r += 1
    for (const c of charts) {
      ws.getCell(`A${r}`).value = c.title
      ws.getCell(`A${r}`).font = { bold: true, color: { argb: XC.head } }
      const b64 = String(c.imgURI).split(',')[1] || c.imgURI
      const imgId = wb.addImage({ base64: b64, extension: 'png' })
      ws.addImage(imgId, { tl: { col: 0, row: r }, ext: { width: 560, height: 320 } })
      r += 18
    }
  }

  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `Scrum_Board_${(pod || 'all').replace(/[^A-Za-z0-9]+/g, '_')}.xlsx`
  a.click()
  URL.revokeObjectURL(a.href)
}
