import React, { useState, useMemo } from 'react'
import Chart from 'react-apexcharts'
import { useApp } from '../store'
import { Empty, Modal, Field, PodBadge } from './ui'
import { Card, KpiCard } from './ChartKit'
import BulkUpload from './BulkUpload'
import { merge } from '../lib/chartTheme'
import { podColor } from '../lib/helpers'
import { exportCSV } from '../lib/exports'

// Severity weights must mirror backend services/defect_service.py WEIGHTS.
const WEIGHTS = { critical: 10, high: 5, medium: 2, low: 1 }
const SEV = [
  { key: 'critical', label: 'Critical', color: '#ef4444' },
  { key: 'high', label: 'High', color: '#f97316' },
  { key: 'medium', label: 'Medium', color: '#f59e0b' },
  { key: 'low', label: 'Low', color: '#22c55e' },
]

// Status + RCA-category option lists (mirror the choices configured for the module).
const STATUSES = ['Open', 'In Progress', 'Fixed', 'Closed', 'Implemented']
const RCA_CATEGORIES = ['Requirements', 'Design / Architecture', 'Coding / Implementation', 'Testing Gap']
const RCA_STATUSES = ['Not Started', 'In Progress', 'Completed', 'Pending Review']
const STATUS_CLS = { Open: 'br', 'In Progress': 'bb', Fixed: 'bt', Closed: 'bg', Implemented: 'bg' }
const RCA_STATUS_CLS = { 'Not Started': 'br', 'In Progress': 'bb', Completed: 'bg', 'Pending Review': 'ba' }

// Clickable count metrics → label + colour for the summary strip and detail popup.
const METRICS = ['total', 'critical', 'high', 'medium', 'low']
const METRIC_META = {
  total: { label: 'Total', color: 'var(--blue)' },
  critical: { label: 'Critical', color: '#ef4444' },
  high: { label: 'High', color: '#f97316' },
  medium: { label: 'Medium', color: '#f59e0b' },
  low: { label: 'Low', color: '#22c55e' },
}
const metricValue = (d, m) => (m === 'total' ? total(d) : (d[m] || 0))

const total = (d) => (d.critical || 0) + (d.high || 0) + (d.medium || 0) + (d.low || 0)
const weighted = (d) => d.critical * WEIGHTS.critical + d.high * WEIGHTS.high + d.medium * WEIGHTS.medium + d.low * WEIGHTS.low

const blankAdd = { release: '', sprint: '', pod: '', critical: 0, high: 0, medium: 0, low: 0, status: 'Open', rca_category: '', rca_status: 'Not Started', rca: '', comments: '' }

// Group records by a key field, summing each severity + derived totals.
function groupBy(rows, field) {
  const map = {}
  rows.forEach((d) => {
    const k = d[field] || '(unspecified)'
    const b = map[k] || (map[k] = { key: k, critical: 0, high: 0, medium: 0, low: 0, total: 0, weighted: 0, records: 0 })
    SEV.forEach((s) => { b[s.key] += d[s.key] || 0 })
    b.total += total(d)
    b.weighted += weighted(d)
    b.records += 1
  })
  return Object.values(map).sort((a, b) => a.key.localeCompare(b.key))
}

export default function Defects() {
  const { data, isAdmin, run, api, toast } = useApp()
  const { defects, pods, sprints } = data
  const [view, setView] = useState('records')   // 'records' | 'report'
  const [relF, setRelF] = useState('')
  const [podF, setPodF] = useState('')
  const [statusF, setStatusF] = useState('')
  const [add, setAdd] = useState(null)
  const [edit, setEdit] = useState(null)
  const [detail, setDetail] = useState(null)   // { metric } — drives the details popup

  // Option lists for the filters / form datalists.
  const releases = useMemo(() => [...new Set(defects.map((d) => d.release).filter(Boolean))].sort(), [defects])
  const sprintNames = useMemo(
    () => [...new Set([...sprints.map((s) => s.sprint), ...defects.map((d) => d.sprint)].filter(Boolean))].sort(),
    [sprints, defects],
  )

  const rows = defects.filter((d) => (!relF || d.release === relF) && (!podF || d.pod === podF) && (!statusF || d.status === statusF))
  const sorted = rows.slice().sort((a, b) =>
    (a.release || '').localeCompare(b.release || '') || (a.sprint || '').localeCompare(b.sprint || '') || (a.pod || '').localeCompare(b.pod || ''))

  const podOptions = pods.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)

  // Severity sums over the currently filtered rows (drives the clickable strip).
  const sums = rows.reduce((a, d) => {
    a.total += total(d); a.critical += d.critical || 0; a.high += d.high || 0
    a.medium += d.medium || 0; a.low += d.low || 0; return a
  }, { total: 0, critical: 0, high: 0, medium: 0, low: 0 })

  // Records (within the current filter) that carry at least one defect of `metric`.
  const detailRows = detail ? rows.filter((d) => metricValue(d, detail.metric) > 0) : []
  const detailSum = detailRows.reduce((s, d) => s + metricValue(d, detail.metric), 0)

  function openAdd() { setAdd({ ...blankAdd, release: relF || (releases[0] || ''), pod: podF || (pods[0] ? pods[0].code : '') }) }
  async function submitAdd() {
    if (!add.release.trim() || !add.sprint.trim()) { toast('Release and Sprint are required', 'e'); return }
    const ok = await run(() => api.createDefect(payload(add)), 'Defect record added!')
    if (ok) setAdd(null)
  }
  function openEdit(d) { setEdit({ ...d }) }
  async function submitEdit() {
    if (!edit.release.trim() || !edit.sprint.trim()) { toast('Release and Sprint are required', 'e'); return }
    const ok = await run(() => api.updateDefect(edit.id, payload(edit)), 'Defect record updated!')
    if (ok) setEdit(null)
  }
  async function del(d) {
    if (!window.confirm(`Remove defects for ${d.release} / ${d.sprint} / ${d.pod || '(no POD)'}?`)) return
    run(() => api.deleteDefect(d.id), 'Removed')
  }

  return (
    <>
      <div className="tb"><h2>Defect Density — Post-Production</h2>
        <div className="tb-r">
          <span className={'stab' + (view === 'records' ? ' active' : '')} onClick={() => setView('records')}>Records</span>
          <span className={'stab' + (view === 'report' ? ' active' : '')} onClick={() => setView('report')}>Report</span>
          {view === 'records' && isAdmin && <button className="btn btn-p btn-sm" onClick={openAdd}>+ Add Record</button>}
          {view === 'records' && <BulkUpload kind="defect" />}
          {view === 'records' && <button className="btn btn-sm" onClick={() => exportCSV('defects', data)}>&#8659; CSV</button>}
        </div>
      </div>

      <div className="con">
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          <select value={relF} onChange={(e) => setRelF(e.target.value)} style={{ maxWidth: 200 }}>
            <option value="">All Releases</option>
            {releases.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <select value={podF} onChange={(e) => setPodF(e.target.value)} style={{ maxWidth: 200 }}>
            <option value="">All PODs</option>
            {pods.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
          </select>
          <select value={statusF} onChange={(e) => setStatusF(e.target.value)} style={{ maxWidth: 200 }}>
            <option value="">All Statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {view === 'records' && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            {METRICS.map((m) => (
              <div key={m} onClick={() => sums[m] && setDetail({ metric: m })}
                title={sums[m] ? 'Click to view all matching records' : 'No defects'}
                style={{ flex: '1 1 120px', minWidth: 110, padding: '10px 14px', borderRadius: 8,
                  background: 'var(--s2)', border: '1px solid var(--b2)',
                  cursor: sums[m] ? 'pointer' : 'default', opacity: sums[m] ? 1 : 0.55 }}>
                <div className="mc-l">{METRIC_META[m].label}</div>
                <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--mono)', color: METRIC_META[m].color }}>{sums[m]}</div>
              </div>
            ))}
          </div>
        )}

        {view === 'records' ? (
          <RecordsTable rows={sorted} pods={pods} isAdmin={isAdmin} onEdit={openEdit} onDelete={del} onMetric={(m) => setDetail({ metric: m })} />
        ) : (
          <Report rows={rows} pods={pods} onMetric={(m) => setDetail({ metric: m })} />
        )}
      </div>

      <Modal open={!!add} title="Add Defect Record" onClose={() => setAdd(null)}
        footer={<><button className="btn" onClick={() => setAdd(null)}>Cancel</button><button className="btn btn-p" onClick={submitAdd}>Add Record</button></>}>
        {add && <DefectForm v={add} setV={setAdd} releases={releases} sprintNames={sprintNames} podOptions={podOptions} />}
      </Modal>

      <Modal open={!!edit} title="Edit Defect Record" onClose={() => setEdit(null)}
        footer={<><button className="btn" onClick={() => setEdit(null)}>Cancel</button><button className="btn btn-p" onClick={submitEdit}>Save</button></>}>
        {edit && <DefectForm v={edit} setV={setEdit} releases={releases} sprintNames={sprintNames} podOptions={podOptions} />}
      </Modal>

      <Modal open={!!detail} width="940px"
        title={detail ? `${METRIC_META[detail.metric].label} defects — ${detailSum} across ${detailRows.length} record${detailRows.length === 1 ? '' : 's'}` : ''}
        onClose={() => setDetail(null)}
        footer={<button className="btn btn-p" onClick={() => setDetail(null)}>Close</button>}>
        {detail && <DetailTable metric={detail.metric} rows={detailRows} pods={pods} />}
      </Modal>
    </>
  )
}

function DetailTable({ metric, rows, pods }) {
  if (!rows.length) return <Empty>No records have {METRIC_META[metric].label.toLowerCase()} defects in the current filter.</Empty>
  const sorted = rows.slice().sort((a, b) =>
    metricValue(b, metric) - metricValue(a, metric)
    || (a.release || '').localeCompare(b.release || '')
    || (a.sprint || '').localeCompare(b.sprint || ''))
  const hot = (key) => (metric === key ? { background: 'rgba(59,130,246,.10)' } : undefined)
  return (
    <div className="tw" style={{ maxHeight: 460, overflowY: 'auto' }}><table>
      <thead><tr>
        <th>Release</th><th>Sprint</th><th>POD</th>
        <th style={hot('critical')}>Crit</th><th style={hot('high')}>High</th>
        <th style={hot('medium')}>Med</th><th style={hot('low')}>Low</th><th style={hot('total')}>Total</th>
        <th>Status</th><th>RCA Category</th><th>RCA Status</th><th>RCA / Comments</th>
      </tr></thead>
      <tbody>
        {sorted.map((d) => (
          <tr key={d.id}>
            <td style={{ fontWeight: 500 }}>{d.release}</td>
            <td>{d.sprint}</td>
            <td>{d.pod ? <PodBadge pods={pods} code={d.pod} podColor={podColor} /> : <span style={{ color: 'var(--mu)' }}>—</span>}</td>
            <td style={hot('critical')}><span className="badge br">{d.critical}</span></td>
            <td style={hot('high')}><span className="badge bor">{d.high}</span></td>
            <td style={hot('medium')}><span className="badge ba">{d.medium}</span></td>
            <td style={hot('low')}><span className="badge bg">{d.low}</span></td>
            <td style={{ fontFamily: 'var(--mono)', fontWeight: 600, ...(hot('total') || {}) }}>{total(d)}</td>
            <td>{d.status ? <span className={'badge ' + (STATUS_CLS[d.status] || 'ba')}>{d.status}</span> : '—'}</td>
            <td style={{ color: 'var(--mu2)', fontSize: 12 }}>{d.rca_category || '-'}</td>
            <td>{d.rca_status ? <span className={'badge ' + (RCA_STATUS_CLS[d.rca_status] || 'ba')}>{d.rca_status}</span> : '—'}</td>
            <td style={{ color: 'var(--mu2)', fontSize: 12, maxWidth: 240 }} title={d.rca || ''}>
              {[d.rca, d.comments].filter(Boolean).join(' · ') || '-'}
            </td>
          </tr>
        ))}
      </tbody>
    </table></div>
  )
}

function payload(v) {
  return {
    release: v.release.trim(), sprint: v.sprint.trim(), pod: v.pod || '',
    critical: parseInt(v.critical) || 0, high: parseInt(v.high) || 0,
    medium: parseInt(v.medium) || 0, low: parseInt(v.low) || 0,
    status: v.status || 'Open', rca_category: v.rca_category || '',
    rca_status: v.rca_status || 'Not Started', rca: v.rca || '',
    comments: v.comments || '',
  }
}

function RecordsTable({ rows, pods, isAdmin, onEdit, onDelete, onMetric }) {
  if (!rows.length) return <Empty>No defect records. Add one or bulk-upload a sheet.</Empty>
  // A count cell that opens the details popup for its metric (when non-zero).
  const Cnt = ({ m, cls, val }) => (
    <span className={cls ? 'badge ' + cls : ''}
      style={{ cursor: val ? 'pointer' : 'default', textDecoration: val ? 'underline dotted' : 'none' }}
      title={val ? `View all ${METRIC_META[m].label.toLowerCase()} records` : undefined}
      onClick={() => val && onMetric(m)}>{val}</span>
  )
  return (
    <div className="tw"><table>
      <thead><tr>
        <th>Release</th><th>Sprint</th><th>POD</th>
        <th>Critical</th><th>High</th><th>Medium</th><th>Low</th><th>Total</th><th>Weighted</th>
        <th>Status</th><th>RCA Category</th><th>RCA Status</th><th>RCA / Comments</th>
        {isAdmin && <th>Actions</th>}
      </tr></thead>
      <tbody>
        {rows.map((d) => (
          <tr key={d.id}>
            <td style={{ fontWeight: 500 }}>{d.release}</td>
            <td>{d.sprint}</td>
            <td>{d.pod ? <PodBadge pods={pods} code={d.pod} podColor={podColor} /> : <span style={{ color: 'var(--mu)' }}>—</span>}</td>
            <td><Cnt m="critical" cls="br" val={d.critical} /></td>
            <td><Cnt m="high" cls="bor" val={d.high} /></td>
            <td><Cnt m="medium" cls="ba" val={d.medium} /></td>
            <td><Cnt m="low" cls="bg" val={d.low} /></td>
            <td style={{ fontFamily: 'var(--mono)', fontWeight: 600 }}><Cnt m="total" val={total(d)} /></td>
            <td style={{ fontFamily: 'var(--mono)', color: 'var(--mu2)' }}>{weighted(d)}</td>
            <td>{d.status ? <span className={'badge ' + (STATUS_CLS[d.status] || 'ba')}>{d.status}</span> : <span style={{ color: 'var(--mu)' }}>—</span>}</td>
            <td style={{ color: 'var(--mu2)', fontSize: 12 }}>{d.rca_category || '-'}</td>
            <td>{d.rca_status ? <span className={'badge ' + (RCA_STATUS_CLS[d.rca_status] || 'ba')}>{d.rca_status}</span> : <span style={{ color: 'var(--mu)' }}>—</span>}</td>
            <td style={{ color: 'var(--mu2)', fontSize: 12, maxWidth: 240 }} title={d.rca || ''}>
              {d.rca ? <span>{d.rca}</span> : null}
              {d.rca && d.comments ? <span style={{ color: 'var(--mu)' }}> · </span> : null}
              {d.comments ? <span style={{ color: 'var(--mu)' }}>{d.comments}</span> : null}
              {!d.rca && !d.comments ? '-' : null}
            </td>
            {isAdmin && <td><div style={{ display: 'flex', gap: 5 }}>
              <button className="btn btn-sm" onClick={() => onEdit(d)}>Edit</button>
              <button className="btn btn-sm btn-d" onClick={() => onDelete(d)}>X</button>
            </div></td>}
          </tr>
        ))}
      </tbody>
    </table></div>
  )
}

function DefectForm({ v, setV, releases, sprintNames, podOptions }) {
  const set = (patch) => setV({ ...v, ...patch })
  return (
    <>
      <div className="fg2">
        <Field label="Release">
          <input list="dd-releases" value={v.release} placeholder="e.g. R2026.1" onChange={(e) => set({ release: e.target.value })} />
          <datalist id="dd-releases">{releases.map((r) => <option key={r} value={r} />)}</datalist>
        </Field>
        <Field label="Sprint">
          <input list="dd-sprints" value={v.sprint} placeholder="e.g. May'26" onChange={(e) => set({ sprint: e.target.value })} />
          <datalist id="dd-sprints">{sprintNames.map((s) => <option key={s} value={s} />)}</datalist>
        </Field>
      </div>
      <Field label="POD / Team"><select value={v.pod} onChange={(e) => set({ pod: e.target.value })}><option value="">(no POD)</option>{podOptions}</select></Field>
      <div className="fg2">
        <Field label="Critical"><input type="number" min="0" value={v.critical} onChange={(e) => set({ critical: e.target.value })} /></Field>
        <Field label="High"><input type="number" min="0" value={v.high} onChange={(e) => set({ high: e.target.value })} /></Field>
      </div>
      <div className="fg2">
        <Field label="Medium"><input type="number" min="0" value={v.medium} onChange={(e) => set({ medium: e.target.value })} /></Field>
        <Field label="Low"><input type="number" min="0" value={v.low} onChange={(e) => set({ low: e.target.value })} /></Field>
      </div>
      <div className="fg2">
        <Field label="Status">
          <select value={v.status || 'Open'} onChange={(e) => set({ status: e.target.value })}>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="RCA Status">
          <select value={v.rca_status || 'Not Started'} onChange={(e) => set({ rca_status: e.target.value })}>
            {RCA_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
      </div>
      <Field label="RCA Category">
        <select value={v.rca_category || ''} onChange={(e) => set({ rca_category: e.target.value })}>
          <option value="">(uncategorised)</option>
          {RCA_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </Field>
      <Field label="RCA (root-cause notes)"><textarea rows="2" value={v.rca || ''} placeholder="What was the root cause?" onChange={(e) => set({ rca: e.target.value })} /></Field>
      <Field label="Comments"><input value={v.comments} placeholder="Optional notes" onChange={(e) => set({ comments: e.target.value })} /></Field>
    </>
  )
}

function Report({ rows, pods, onMetric }) {
  if (!rows.length) return <Empty>No defects match the current filter — nothing to report.</Empty>

  const totals = rows.reduce((a, d) => {
    SEV.forEach((s) => { a[s.key] += d[s.key] || 0 })
    a.total += total(d); a.weighted += weighted(d); return a
  }, { critical: 0, high: 0, medium: 0, low: 0, total: 0, weighted: 0 })

  const byRelease = groupBy(rows, 'release')
  const bySprint = groupBy(rows, 'sprint')
  const byPod = groupBy(rows, 'pod')
  const byCategory = groupBy(rows, 'rca_category')
  const byStatus = groupBy(rows, 'status')
  const byRcaStatus = groupBy(rows, 'rca_status')

  // Stacked severity columns helper.
  const stacked = (id, groups) => ({
    series: SEV.map((s) => ({ name: s.label, data: groups.map((g) => g[s.key]) })),
    options: merge({
      chart: { id, type: 'bar', stacked: true },
      colors: SEV.map((s) => s.color),
      plotOptions: { bar: { columnWidth: '55%', borderRadius: 3 } },
      xaxis: { categories: groups.map((g) => g.key) },
      yaxis: { title: { text: 'Defects', style: { color: '#5e6a82', fontWeight: 500 } } },
      legend: { position: 'top' },
    }),
  })

  // Total-defects trend across releases (line).
  const trend = {
    series: [{ name: 'Total Defects', data: byRelease.map((g) => g.total) },
             { name: 'Weighted Score', data: byRelease.map((g) => g.weighted) }],
    options: merge({
      chart: { id: 'd-trend', type: 'line' },
      colors: ['#3b82f6', '#8b5cf6'],
      stroke: { width: 3, curve: 'smooth' },
      markers: { size: 4 },
      xaxis: { categories: byRelease.map((g) => g.key) },
      legend: { position: 'top' },
    }),
  }

  const critColor = totals.critical > 0 ? 'var(--red)' : 'var(--green)'

  return (
    <>
      <div className="g4" style={{ marginBottom: 16 }}>
        <div onClick={() => totals.total && onMetric('total')} style={{ cursor: totals.total ? 'pointer' : 'default' }} title="View all matching records">
          <KpiCard label="Total Defects" value={totals.total} sub={`${rows.length} record${rows.length === 1 ? '' : 's'}`} />
        </div>
        <div onClick={() => totals.critical && onMetric('critical')} style={{ cursor: totals.critical ? 'pointer' : 'default' }} title="View all matching records">
          <KpiCard label="Critical" value={totals.critical} valueColor={critColor} sub="post-production" />
        </div>
        <div onClick={() => totals.high && onMetric('high')} style={{ cursor: totals.high ? 'pointer' : 'default' }} title="View all matching records">
          <KpiCard label="High" value={totals.high} valueColor="#f97316" sub="post-production" />
        </div>
        <KpiCard label="Weighted Score" value={totals.weighted} valueColor="#8b5cf6" sub="C·10 H·5 M·2 L·1" />
      </div>

      <div className="g2">
        <Card title="Defects by Release (severity)" height={300} chartId="d-release">
          <Chart {...stacked('d-release', byRelease)} type="bar" height={300} />
        </Card>
        <Card title="Defects by Sprint (severity)" height={300} chartId="d-sprint">
          <Chart {...stacked('d-sprint', bySprint)} type="bar" height={300} />
        </Card>
        <Card title="Defects by POD (severity)" height={300} chartId="d-pod">
          <Chart {...stacked('d-pod', byPod)} type="bar" height={300} />
        </Card>
        <Card title="Defects by RCA Category (severity)" height={300} chartId="d-cat">
          <Chart {...stacked('d-cat', byCategory)} type="bar" height={300} />
        </Card>
        <Card title="Defects by Status (severity)" height={300} chartId="d-status">
          <Chart {...stacked('d-status', byStatus)} type="bar" height={300} />
        </Card>
        <Card title="Defects by RCA Status (severity)" height={300} chartId="d-rcastatus">
          <Chart {...stacked('d-rcastatus', byRcaStatus)} type="bar" height={300} />
        </Card>
        <Card title="Release Trend — total vs weighted" height={300} chartId="d-trend">
          <Chart {...trend} type="line" height={300} />
        </Card>
      </div>
    </>
  )
}
