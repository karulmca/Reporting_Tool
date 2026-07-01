// CSV + printable-PDF exports, mirroring the original tool.
import * as XLSX from 'xlsx'
import { implCount, progCount, memberName, memberByID, resolveContributorNames } from './helpers'

function downloadCSV(header, rows, filename) {
  const lines = [header.join(',')]
  rows.forEach((r) => {
    lines.push(r.map((v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"').join(','))
  })
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
}

export function exportCSV(view, data, opts = {}) {
  const { members, ideas, sprints, training, defects } = data
  const pod = opts.pod || ''
  const sl = opts.sl || ''
  if (view === 'members') {
    let list = members
    if (sl) list = list.filter((m) => m.sl === sl)
    if (pod) list = list.filter((m) => m.pod === pod)
    const submittedCount = (id) => ideas.filter((i) => i.submitter === id).length
    const fname = pod ? `members_${pod}` : sl ? `members_${sl.replace(/[^a-z0-9]+/gi, '_')}` : 'members'
    downloadCSV(
      ['Emp ID', 'Name', 'POD', 'Service Line', 'Country', 'Target', 'Submitted', 'Implemented', 'In Progress', 'Gap'],
      list.map((m) => [m.id, m.name, m.pod, m.sl, m.country || '', m.target, submittedCount(m.id), implCount(ideas, m.id), progCount(ideas, m.id), m.target - implCount(ideas, m.id)]),
      `${fname}.csv`,
    )
  } else if (view === 'ideas') {
    // Prefer a known member's (possibly refreshed) name, else the sheet name, else the id.
    const subName = (i) => { const n = memberName(members, i.submitter); return n === i.submitter ? (i.submitter_name || i.submitter) : n }
    // Submitter's team/POD (blank when the submitter isn't a mapped member).
    const podOf = (i) => { const m = memberByID(members, i.submitter); return m ? (m.pod || '') : '' }
    const sorted = ideas.slice().sort((a, b) => subName(a).localeCompare(subName(b)) || (a.title || '').localeCompare(b.title || ''))
    downloadCSV(
      ['Idea ID', 'Title', 'Status', 'Stage', 'Saving Type', 'Savings Amount', 'Workflow', 'Submitter', 'Submitter ID', 'POD', 'Contributors',
        'Project', 'Competency', 'Tags', 'Source', 'Rating', 'Sprint', 'Problem', 'Description', 'Solution', 'Benefit'],
      sorted.map((i) => [
        i.idea_id, i.title, i.status, i.stage, i.savings_type || '', i.savings_amount || 0, i.workflow, subName(i), i.submitter, podOf(i), i.contributors,
        i.project_name, i.competency, i.tags, i.source, i.rating, i.sprint, i.problem, i.description, i.solution, i.benefit,
      ]),
      'ideas.csv',
    )
  } else if (view === 'sprints') {
    downloadCSV(
      ['Member', 'Sprint', 'Committed SP', 'Completed SP', 'Idea Target', 'Comments'],
      sprints.map((s) => [memberName(members, s.member), s.sprint, s.committed, s.completed, s.targetIdeas || 0, s.comments]),
      'sprints.csv',
    )
  } else if (view === 'defects') {
    downloadCSV(
      ['Release', 'Sprint', 'POD', 'Critical', 'High', 'Medium', 'Low', 'Total', 'Weighted', 'Status', 'RCA Category', 'RCA Status', 'RCA', 'Comments'],
      (defects || []).map((d) => {
        const t = (d.critical || 0) + (d.high || 0) + (d.medium || 0) + (d.low || 0)
        const w = d.critical * 10 + d.high * 5 + d.medium * 2 + d.low * 1
        return [d.release, d.sprint, d.pod, d.critical, d.high, d.medium, d.low, t, w, d.status, d.rca_category, d.rca_status, d.rca, d.comments]
      }),
      'defects.csv',
    )
  } else if (view === 'training') {
    const courses = training.courses || []
    downloadCSV(
      ['Member', 'Emp ID'].concat(courses.map((c) => c.id)),
      members.map((m) => [m.name, m.id].concat(courses.map((c) => (training.status[m.id] || {})[c.id] || ''))),
      'training.csv',
    )
  }
}

export function exportPDF(data) {
  const { members, sprints } = data
  const tC = sprints.reduce((a, b) => a + b.committed, 0)
  const tD = sprints.reduce((a, b) => a + b.completed, 0)
  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(
    '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Sprint Report</title><style>body{font-family:Segoe UI,sans-serif;font-size:13px;color:#111;padding:36px}h1{font-size:22px;font-weight:700;margin-bottom:4px}.sub{color:#666;font-size:12px;margin-bottom:20px}.metrics{display:flex;gap:14px;margin-bottom:20px}.m{background:#f5f7fa;border-radius:8px;padding:12px 18px;flex:1}.mv{font-size:24px;font-weight:700;color:#1d4ed8}.ml{font-size:11px;color:#888;text-transform:uppercase;margin-top:4px}table{width:100%;border-collapse:collapse}th{background:#f5f7fa;font-size:11px;text-transform:uppercase;color:#555;padding:9px 12px;text-align:left}td{padding:9px 12px;border-bottom:1px solid #eee;font-size:12px}.footer{margin-top:24px;font-size:11px;color:#aaa;border-top:1px solid #eee;padding-top:10px}</style></head><body>' +
      '<h1>BlueBolt Sprint Report</h1>' +
      '<div class="sub">Generated ' + new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) + '</div>' +
      '<div class="metrics"><div class="m"><div class="mv">' + tC + '</div><div class="ml">Committed SP</div></div><div class="m"><div class="mv">' + tD + '</div><div class="ml">Completed SP</div></div><div class="m"><div class="mv">' + (tC ? Math.round((tD / tC) * 100) : 0) + '%</div><div class="ml">Completion Rate</div></div><div class="m"><div class="mv">' + members.length + '</div><div class="ml">Members</div></div></div>' +
      '<table><thead><tr><th>Member</th><th>Sprint</th><th>Committed</th><th>Completed</th><th>Target Ideas</th><th>Comments</th></tr></thead><tbody>' +
      sprints.map((s) => '<tr><td>' + memberName(members, s.member) + '</td><td>' + s.sprint + '</td><td>' + s.committed + '</td><td>' + s.completed + '</td><td>' + (s.targetIdeas || 0) + '</td><td>' + (s.comments || '-') + '</td></tr>').join('') +
      '</tbody></table><div class="footer">BlueBolt Innovation Tracker</div></body></html>',
  )
  win.document.close()
  win.focus()
  setTimeout(() => win.print(), 500)
}

// ---- Dashboard status workbook ---------------------------------------------
// Sheet 1: overall per-POD status. Then one sheet per POD with that team's
// summary, member breakdown and ideas. For sharing the overall picture.
const DASH_STATUSES = ['Implemented', 'In Progress', 'POC Stage', 'Proposed', 'New', 'Ideation']

function _sheetName(used, raw) {
  // Excel sheet names: <=31 chars, none of : \ / ? * [ ]
  let name = String(raw || 'POD').replace(/[:\\/?*[\]]/g, ' ').trim().slice(0, 31) || 'POD'
  let base = name, n = 1
  while (used.has(name.toLowerCase())) { const suffix = ' (' + (++n) + ')'; name = base.slice(0, 31 - suffix.length) + suffix }
  used.add(name.toLowerCase())
  return name
}

export function exportDashboardXLSX(data) {
  const { members, ideas, pods } = data
  const courses = (data.training && data.training.courses) || []
  const tstatus = (data.training && data.training.status) || {}
  const podCodes = new Set(pods.map((p) => p.code))

  const idsOf = (mem) => new Set(mem.map((m) => m.id))
  const ideasOf = (ids) => ideas.filter((i) => ids.has(i.submitter))
  const statusCounts = (list) => DASH_STATUSES.map((st) => list.filter((i) => i.status === st).length)
  const trainingPct = (mem) => {
    const cells = mem.length * courses.length
    if (!cells) return 0
    const done = courses.reduce((a, c) => a + mem.filter((m) => (tstatus[m.id] || {})[c.id] === 'Completed').length, 0)
    return Math.round((done / cells) * 100)
  }
  const statusRow = (label, name, mem, list) => {
    const counts = statusCounts(list)
    const impl = counts[0]
    const target = mem.reduce((a, m) => a + (m.target || 0), 0)
    return [label, name, mem.length, list.length, ...counts, target, target - impl,
      target ? Math.round((impl / target) * 100) : 0, trainingPct(mem)]
  }

  const wb = XLSX.utils.book_new()
  const used = new Set()

  // --- Sheet 1: overall ----------------------------------------------------
  const header = ['POD', 'Name', 'Members', 'Total Ideas', ...DASH_STATUSES, 'Target', 'Gap', 'Attainment %', 'Training %']
  const overall = [
    ['BlueBolt — Dashboard Status'],
    ['Generated', new Date().toLocaleString('en-IN')],
    [],
    header,
  ]
  pods.forEach((p) => overall.push(statusRow(p.code, p.name, members.filter((m) => m.pod === p.code), ideasOf(idsOf(members.filter((m) => m.pod === p.code))))))
  // Ideas whose submitter isn't mapped to any POD.
  const unmappedMem = members.filter((m) => !(m.pod && podCodes.has(m.pod)))
  const mappedIds = new Set(members.filter((m) => m.pod && podCodes.has(m.pod)).map((m) => m.id))
  const unmappedIdeas = ideas.filter((i) => !mappedIds.has(i.submitter))
  if (unmappedIdeas.length || unmappedMem.length) overall.push(statusRow('(Unmapped)', 'Submitter not in a POD', unmappedMem, unmappedIdeas))
  overall.push(statusRow('TOTAL', 'All PODs', members, ideas))
  const ws1 = XLSX.utils.aoa_to_sheet(overall)
  ws1['!cols'] = header.map((h, i) => ({ wch: i === 1 ? 22 : Math.max(10, h.length + 2) }))
  XLSX.utils.book_append_sheet(wb, ws1, _sheetName(used, 'Overall'))

  // --- One sheet per POD ---------------------------------------------------
  pods.forEach((p) => {
    const mem = members.filter((m) => m.pod === p.code).slice().sort((a, b) => a.name.localeCompare(b.name))
    const ids = idsOf(mem)
    const pIdeas = ideasOf(ids)
    const impl = pIdeas.filter((i) => i.status === 'Implemented').length
    const target = mem.reduce((a, m) => a + (m.target || 0), 0)
    const aoa = [
      [`${p.code} — ${p.name}`],
      ['Members', mem.length, '', 'Total Ideas', pIdeas.length],
      ['Implemented', impl, '', 'In Progress', pIdeas.filter((i) => i.status === 'In Progress').length],
      ['Target', target, '', 'Gap', target - impl],
      ['Attainment %', target ? Math.round((impl / target) * 100) : 0, '', 'Training %', trainingPct(mem)],
      [],
      ['MEMBERS'],
      ['Name', 'Emp ID', 'Target', 'Implemented', 'In Progress', 'Gap', 'Attainment %'],
      ...mem.map((m) => {
        const d = implCount(ideas, m.id)
        return [m.name, m.id, m.target, d, progCount(ideas, m.id), m.target - d, m.target ? Math.round((d / m.target) * 100) : 0]
      }),
      [],
      ['IDEAS'],
      ['Idea ID', 'Title', 'Status', 'Stage', 'Workflow', 'Submitter'],
      ...pIdeas.map((i) => [i.idea_id, i.title, i.status, i.stage, i.workflow, memberName(members, i.submitter)]),
    ]
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    ws['!cols'] = [{ wch: 26 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 14 }]
    XLSX.utils.book_append_sheet(wb, ws, _sheetName(used, p.code || p.name))
  })

  XLSX.writeFile(wb, 'BlueBolt_Dashboard_Status.xlsx')
}
