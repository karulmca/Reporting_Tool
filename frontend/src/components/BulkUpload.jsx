import React, { useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { useApp } from '../store'
import { Modal } from './ui'
import { STATUSES } from '../lib/helpers'

// Per-entity configuration: template columns, row mapping and the bulk call.
// `pod` (optional) scopes pre-filled template rows (used by the Sprint Tracker).
function buildConfig(kind, data, pod) {
  const cf = data.customFields[kind] || []
  const cfCols = cf.map((f) => f.label)
  const cfObj = (r) => cf.reduce((o, f) => {
    const v = r[f.label]
    if (v !== '' && v != null) o[f.id] = String(v)
    return o
  }, {})

  if (kind === 'member') {
    const base = ['Employee ID', 'Full Name', 'POD Code', 'Service Line', 'Annual Target']
    const codes = data.pods.map((p) => p.code).join(', ')
    return {
      label: 'Members',
      sheet: 'Members',
      filename: 'members_template.xlsx',
      columns: base.concat(cfCols),
      baseRequired: ['Employee ID', 'Full Name'],
      comments: [{ col: 'POD Code', text: 'Enter one of these POD codes: ' + (codes || '(no PODs defined yet)') + '\nSee the "PODs" sheet for the full list.' }],
      toRow: (r) => ({
        id: String(r['Employee ID'] || '').trim(),
        name: String(r['Full Name'] || '').trim(),
        // Accept the new "POD Code" header (and the old "POD") for safety.
        pod: String(r['POD Code'] || r['POD'] || '').trim(),
        sl: String(r['Service Line'] || '').trim() || 'M&E',
        target: parseInt(r['Annual Target'], 10) || 12,
        custom: cfObj(r),
      }),
      refSheet: 'PODs',
      reference: [
        ['VALID PODs — type the Code into the "POD Code" column', '', ''],
        ['Code', 'Name', 'Service Line'],
        ...data.pods.map((p) => [p.code, p.name, p.sl]),
        ['', '', ''],
        ['Notes', '', ''],
        ['POD Code', 'must exactly match a Code above (blank = no POD)', ''],
        ['Annual Target', 'whole number (default 12)', ''],
        ['Employee ID', 'existing IDs are updated; new IDs are created', ''],
      ],
      call: (api, rows) => api.bulkMembers(rows),
    }
  }
  if (kind === 'defect') {
    const codes = data.pods.map((p) => p.code).join(', ')
    const sprintNames = [...new Set((data.sprints || []).map((s) => s.sprint).filter(Boolean))]
    return {
      label: 'Defect Records',
      sheet: 'Defects',
      filename: 'defects_template.xlsx',
      columns: ['Release', 'Sprint', 'POD Code', 'Critical', 'High', 'Medium', 'Low', 'Status', 'RCA Category', 'RCA Status', 'RCA', 'Comments'],
      baseRequired: ['Release', 'Sprint'],
      comments: [
        { col: 'POD Code', text: 'Enter one of these POD codes: ' + (codes || '(no PODs defined yet)') + '\nLeave blank for a record not tied to a POD.' },
        { col: 'Status', text: 'One of: Open, In Progress, Fixed, Closed, Implemented (blank = Open).' },
        { col: 'RCA Category', text: 'One of: Requirements, Design / Architecture, Coding / Implementation, Testing Gap (blank allowed).' },
        { col: 'RCA Status', text: 'One of: Not Started, In Progress, Completed, Pending Review (blank = Not Started).' },
      ],
      toRow: (r) => ({
        release: String(r['Release'] || '').trim(),
        sprint: String(r['Sprint'] || '').trim(),
        pod: String(r['POD Code'] || r['POD'] || '').trim(),
        critical: parseInt(r['Critical'], 10) || 0,
        high: parseInt(r['High'], 10) || 0,
        medium: parseInt(r['Medium'], 10) || 0,
        low: parseInt(r['Low'], 10) || 0,
        status: String(r['Status'] || '').trim(),
        rca_category: String(r['RCA Category'] || '').trim(),
        rca_status: String(r['RCA Status'] || '').trim(),
        rca: String(r['RCA'] || '').trim(),
        comments: String(r['Comments'] || '').trim(),
      }),
      refSheet: 'Reference',
      reference: [
        ['VALID PODs — type the Code into the "POD Code" column', '', ''],
        ['Code', 'Name', 'Service Line'],
        ...data.pods.map((p) => [p.code, p.name, p.sl]),
        ['', '', ''],
        ['KNOWN SPRINTS — use the same names as the Sprint Tracker', '', ''],
        ...sprintNames.map((s) => [s, '', '']),
        ['', '', ''],
        ['VALID STATUSES', '', ''],
        ...['Open', 'In Progress', 'Fixed', 'Closed', 'Implemented'].map((s) => [s, '', '']),
        ['', '', ''],
        ['VALID RCA CATEGORIES', '', ''],
        ...['Requirements', 'Design / Architecture', 'Coding / Implementation', 'Testing Gap'].map((c) => [c, '', '']),
        ['', '', ''],
        ['VALID RCA STATUSES', '', ''],
        ...['Not Started', 'In Progress', 'Completed', 'Pending Review'].map((s) => [s, '', '']),
        ['', '', ''],
        ['Notes', '', ''],
        ['Release', 'free text label, e.g. R2026.1 (required)', ''],
        ['Sprint', 'sprint period name, e.g. May’26 (required)', ''],
        ['Critical/High/Medium/Low', 'whole numbers (blank = 0)', ''],
        ['Status', 'blank defaults to Open', ''],
        ['Matching Release+Sprint+POD rows are updated; new ones created', '', ''],
      ],
      call: (api, rows) => api.bulkDefects(rows),
    }
  }
  if (kind === 'sprint') {
    const sprintNames = [...new Set((data.sprints || []).map((s) => s.sprint).filter(Boolean))]
    // Pre-fill one row per member of the selected POD (or all members).
    const poolMembers = (pod ? data.members.filter((m) => m.pod === pod) : data.members)
      .slice().sort((a, b) => a.name.localeCompare(b.name))
    return {
      label: 'Sprint Entries',
      sheet: 'Sprints',
      filename: pod ? `sprints_${pod}_template.xlsx` : 'sprints_template.xlsx',
      columns: ['Employee ID', 'Full Name', 'Sprint', 'Committed SP', 'Completed SP', 'Idea Target', 'Comments'],
      baseRequired: ['Employee ID', 'Sprint'],
      comments: [{ col: 'Sprint', text: 'Enter the sprint / iteration name for each row (e.g. Sprint 8). Rows left without a Sprint are ignored on import.' }],
      // Rows pre-filled with Emp ID + Name; user fills Sprint + numbers.
      templateRows: poolMembers.map((m) => [m.id, m.name, '', '', '', '', '']),
      toRow: (r) => ({
        member: String(r['Employee ID'] || r['Emp ID'] || '').trim(),
        sprint: String(r['Sprint'] || '').trim(),
        committed: parseFloat(r['Committed SP']) || 0,
        completed: parseFloat(r['Completed SP']) || 0,
        targetIdeas: parseFloat(r['Idea Target']) || 0,
        comments: String(r['Comments'] || '').trim(),
      }),
      // Ignore pre-filled rows the user didn't assign a sprint to.
      skipRow: (r) => !r.sprint,
      refSheet: 'Reference',
      reference: [
        ['Keyed on (Employee ID + Sprint) — existing entries are updated, new ones created', '', ''],
        ['Rows without a Sprint value are ignored on import', '', ''],
        ['', '', ''],
        ['KNOWN SPRINTS', '', ''],
        ...sprintNames.map((s) => [s, '', '']),
      ],
      call: (api, rows) => api.bulkSprints(rows),
    }
  }
  // idea — matches the "Idea Wall" export. Keyed on (submitter Emp ID, Idea ID):
  // re-uploading the same pair updates the existing idea.
  // Whitespace-tolerant header lookup (the export has trailing/odd spaces).
  const norm = (s) => String(s).replace(/\s+/g, ' ').trim().toLowerCase()
  const pick = (r, ...names) => {
    const keys = Object.keys(r)
    for (const n of names) {
      const k = keys.find((kk) => norm(kk) === norm(n))
      if (k != null) return r[k]
    }
    return ''
  }
  // "Surname,Given(123456)" -> { id, name }
  const parseEmp = (s) => {
    const t = String(s || '').trim()
    const m = t.match(/\((\d+)\)\s*$/)
    return m ? { id: m[1], name: t.slice(0, t.lastIndexOf('(')).trim() } : { id: '', name: t }
  }
  const ideaCols = [
    'Idea ID', 'ESA Project Name', 'Idea Submitter Name & ID', 'Idea Contributors Name & ID',
    'Idea Title', 'Problem Statement', 'Idea Description', 'Solution', 'Benefit Description',
    'Idea Competency', 'Tags', 'Stage of the Idea', 'Idea Workflow', 'Idea source',
    'Idea Created On', 'Overall Idea Rating',
  ]
  return {
    label: 'Ideas',
    sheet: 'Idea Data',
    filename: 'ideas_template.xlsx',
    columns: ideaCols.concat(cfCols),
    baseRequired: ['Idea ID', 'Idea Submitter Name & ID'],
    toRow: (r) => {
      const emp = parseEmp(pick(r, 'Idea Submitter Name & ID', 'Submitter (Emp ID)', 'Submitter'))
      return {
        idea_id: String(pick(r, 'Idea ID') || '').trim(),
        submitter: emp.id,
        submitter_name: emp.name,
        contributors: String(pick(r, 'Idea Contributors Name & ID', 'Contributors') || '').trim(),
        project_name: String(pick(r, 'ESA Project Name') || '').trim(),
        title: String(pick(r, 'Idea Title', 'Title') || '').trim(),
        problem: String(pick(r, 'Problem Statement') || ''),
        desc: String(pick(r, 'Idea Description', 'Description') || ''),
        solution: String(pick(r, 'Solution') || ''),
        benefit: String(pick(r, 'Benefit Description', 'Benefit') || ''),
        competency: String(pick(r, 'Idea Competency') || '').trim(),
        tags: String(pick(r, 'Tags') || '').trim(),
        stage: String(pick(r, 'Stage of the Idea') || '').trim(),
        workflow: String(pick(r, 'Idea Workflow') || '').trim(),
        source: String(pick(r, 'Idea source') || '').trim(),
        created_on: String(pick(r, 'Idea Created On') || '').trim(),
        rating: parseFloat(pick(r, 'Overall Idea Rating')) || 0,
        custom: cfObj(r),
      }
    },
    refSheet: 'Reference',
    reference: [
      ['KEY — ideas are matched on (Submitter Emp ID + Idea ID)', '', ''],
      ['Re-uploading the same pair UPDATES the existing idea', '', ''],
      ['', '', ''],
      ['Idea Submitter Name & ID', 'format: Surname,Given(EmpID) e.g. Kuppusamy,Arul(2012144)', ''],
      ['', '', ''],
      ['STAGE → app status mapping', '', ''],
      ['Approved for implementation', '→ POC Stage', ''],
      ['Implementation in progress', '→ In Progress', ''],
      ['Implemented / Completed', '→ Implemented', ''],
      ['On-Hold / Rejected / other', '→ Proposed', ''],
      ['', '', ''],
      ['EXISTING MEMBERS — matching Emp IDs get their name refreshed', '', ''],
      ['Emp ID', 'Name', 'POD'],
      ...data.members.map((m) => [m.id, m.name, m.pod]),
    ],
    call: (api, rows) => api.bulkIdeas(rows),
  }
}

// A labelled count card for the upload-summary popup.
function Stat({ label, value, color }) {
  return (
    <div style={{ flex: '1 1 110px', minWidth: 100, padding: '10px 14px', borderRadius: 8, background: 'var(--s2)', border: '1px solid var(--b2)' }}>
      <div className="mc-l">{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--mono)', color: color || 'var(--tx)' }}>{value}</div>
    </div>
  )
}

export default function BulkUpload({ kind, pod }) {
  const { data, api, loadAll, toast } = useApp()
  const inputRef = useRef(null)
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)

  function downloadTemplate() {
    const cfg = buildConfig(kind, data, pod)
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet([cfg.columns, ...(cfg.templateRows || [])])
    ws['!cols'] = cfg.columns.map((c) => ({ wch: Math.max(14, c.length + 2) }))
    // Attach header-cell comments (e.g. the list of valid POD codes).
    ;(cfg.comments || []).forEach((cm) => {
      const idx = cfg.columns.indexOf(cm.col)
      if (idx < 0) return
      const ref = XLSX.utils.encode_cell({ r: 0, c: idx })
      if (ws[ref]) { ws[ref].c = [{ a: 'BlueBolt', t: cm.text }]; ws[ref].c.hidden = true }
    })
    XLSX.utils.book_append_sheet(wb, ws, cfg.sheet)
    const ref = XLSX.utils.aoa_to_sheet(cfg.reference)
    ref['!cols'] = [{ wch: 26 }, { wch: 42 }, { wch: 16 }]
    XLSX.utils.book_append_sheet(wb, ref, cfg.refSheet || 'Reference')
    XLSX.writeFile(wb, cfg.filename)
    toast('Template downloaded', 'i')
  }

  async function onFile(e) {
    const file = e.target.files && e.target.files[0]
    e.target.value = '' // allow re-uploading the same file
    if (!file) return
    const cfg = buildConfig(kind, data, pod)
    setBusy(true)
    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const ws = wb.Sheets[cfg.sheet] || wb.Sheets[wb.SheetNames[0]]
      const json = XLSX.utils.sheet_to_json(ws, { raw: false, defval: '' })
      const isEmpty = (r) => cfg.columns.every((c) => String(r[c] || '').trim() === '')
      let rows = json.filter((r) => !isEmpty(r)).map(cfg.toRow)
      if (cfg.skipRow) rows = rows.filter((r) => !cfg.skipRow(r))
      if (!rows.length) { toast('No data rows found in the sheet', 'e'); setBusy(false); return }
      const res = await cfg.call(api, rows)
      setResult({ ...res, label: cfg.label })   // show the summary popup immediately
      await loadAll()
      const parts = [`${res.created} inserted`]
      if (res.updated != null) parts.push(`${res.updated} updated`)
      if (res.errors && res.errors.length) parts.push(`${res.errors.length} skipped`)
      toast(parts.join(' · '), res.errors && res.errors.length ? 'i' : 's')
    } catch (err) {
      toast('Upload failed: ' + err.message, 'e')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button className="btn btn-sm" onClick={downloadTemplate} title="Download an Excel template">&#8675; Template</button>
      <button className="btn btn-sm btn-p" disabled={busy} onClick={() => inputRef.current && inputRef.current.click()} title="Upload a filled-in sheet">
        {busy ? 'Uploading…' : '↥ Bulk Upload'}
      </button>
      <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={onFile} />

      <Modal open={!!result} title={`Bulk Upload — ${result ? result.label : ''}`} width="560px" onClose={() => setResult(null)}
        footer={<button className="btn btn-p" onClick={() => setResult(null)}>Done</button>}>
        {result && <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <Stat label="Inserted (new)" value={result.created || 0} color="var(--green)" />
            {result.updated != null && <Stat label="Updated (existing)" value={result.updated} color="var(--blue)" />}
            <Stat label="Skipped" value={(result.errors || []).length} color={(result.errors || []).length ? 'var(--amber)' : 'var(--mu2)'} />
            <Stat label="Rows processed" value={result.total} color="var(--mu2)" />
          </div>
          {result.members_updated != null && result.members_updated > 0 && (
            <div style={{ fontSize: 12, color: 'var(--mu2)', marginBottom: 12 }}>
              {result.members_updated} existing member name{result.members_updated === 1 ? '' : 's'} refreshed from the sheet.
            </div>
          )}
          {result.errors && result.errors.length > 0 ? (
            <>
              <div className="sh">Skipped rows</div>
              <div className="tw" style={{ maxHeight: 280, overflowY: 'auto' }}>
                <table>
                  <thead><tr><th>Sheet Row</th><th>Reason</th></tr></thead>
                  <tbody>{result.errors.map((er, k) => (
                    <tr key={k}><td style={{ fontFamily: 'var(--mono)' }}>{er.row}</td><td style={{ color: 'var(--mu2)' }}>{er.error}</td></tr>
                  ))}</tbody>
                </table>
              </div>
            </>
          ) : <div style={{ color: 'var(--green)', fontSize: 13 }}>All rows imported successfully.</div>}
        </>}
      </Modal>
    </>
  )
}
