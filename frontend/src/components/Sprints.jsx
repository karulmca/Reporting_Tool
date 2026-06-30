import React, { useState, useEffect } from 'react'
import { useApp } from '../store'
import { Avatar, PodBadge, Empty, Modal, Field } from './ui'
import PodFilter from './PodFilter'
import BulkUpload from './BulkUpload'
import { memberByID, podColor } from '../lib/helpers'
import { exportCSV, exportPDF } from '../lib/exports'

// One editable row in the Sprint Tracker grid. Values are controlled by the
// parent's draft state so a single "Save All" can commit every edited row.
function SprintRow({ s, members, pods, isAdmin, draft, onChange, onSave, onDelete }) {
  const m = memberByID(members, s.member)
  const committed = draft.committed
  const completed = draft.completed
  const target = draft.targetIdeas
  const comments = draft.comments
  const pp = committed ? Math.min(100, Math.round((completed / committed) * 100)) : 0
  const ppCol = pp >= 80 ? 'var(--green)' : pp >= 50 ? 'var(--amber)' : 'var(--red)'
  const dirty = Number(committed) !== s.committed || Number(completed) !== s.completed
    || Number(target) !== (s.targetIdeas || 0) || comments !== (s.comments || '')
  const numStyle = { width: 78, padding: '5px 8px', fontFamily: 'var(--mono)' }

  if (!isAdmin) {
    return (
      <tr>
        <td><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{m ? <><Avatar members={members} name={m.name} size={26} />{m.name}</> : <span style={{ color: 'var(--mu)' }}>{s.member}</span>}</div></td>
        <td>{m && <PodBadge pods={pods} code={m.pod} podColor={podColor} />}</td>
        <td style={{ fontFamily: 'var(--mono)', fontSize: 14, fontWeight: 700, color: 'var(--blue)' }}>{s.committed}</td>
        <td style={{ fontFamily: 'var(--mono)', fontSize: 14, fontWeight: 700, color: 'var(--green)' }}>{s.completed}</td>
        <td><div style={{ display: 'flex', alignItems: 'center', gap: 7 }}><div style={{ width: 60, height: 5, background: 'var(--s3)', borderRadius: 3, overflow: 'hidden' }}><div style={{ width: pp + '%', height: '100%', background: ppCol }} /></div><span style={{ fontSize: 11, color: 'var(--mu)' }}>{pp}%</span></div></td>
        <td style={{ fontFamily: 'var(--mono)' }}>{s.targetIdeas || 0}</td>
        <td style={{ fontSize: 11, color: 'var(--mu2)' }}>{s.comments || '-'}</td>
      </tr>
    )
  }

  return (
    <tr>
      <td><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{m ? <><Avatar members={members} name={m.name} size={26} />{m.name}</> : <span style={{ color: 'var(--mu)' }}>{s.member}</span>}</div></td>
      <td>{m && <PodBadge pods={pods} code={m.pod} podColor={podColor} />}</td>
      <td><input type="number" min="0" style={dirty ? { ...numStyle, borderColor: 'var(--amber)' } : numStyle} value={committed} onChange={(e) => onChange('committed', e.target.value)} /></td>
      <td><input type="number" min="0" style={numStyle} value={completed} onChange={(e) => onChange('completed', e.target.value)} /></td>
      <td><div style={{ display: 'flex', alignItems: 'center', gap: 7 }}><div style={{ width: 60, height: 5, background: 'var(--s3)', borderRadius: 3, overflow: 'hidden' }}><div style={{ width: pp + '%', height: '100%', background: ppCol }} /></div><span style={{ fontSize: 11, color: 'var(--mu)' }}>{pp}%</span></div></td>
      <td><input type="number" min="0" style={{ ...numStyle, width: 70 }} value={target} onChange={(e) => onChange('targetIdeas', e.target.value)} /></td>
      <td><input style={{ minWidth: 150, padding: '5px 8px' }} value={comments} placeholder="—" onChange={(e) => onChange('comments', e.target.value)} /></td>
      <td><div style={{ display: 'flex', gap: 5 }}>
        <button className="btn btn-sm btn-p" disabled={!dirty} onClick={() => onSave(s, { committed, completed, targetIdeas: target, comments })}>Save</button>
        <button className="btn btn-sm btn-d" onClick={() => onDelete(s)}>X</button>
      </div></td>
    </tr>
  )
}

export default function Sprints() {
  const { data, isAdmin, run, api, toast, loadAll } = useApp()
  const { members, sprints } = data
  const [podF, setPodF] = useState('')
  const [active, setActive] = useState('')
  const [form, setForm] = useState(null)
  const [rename, setRename] = useState(null)
  const [drafts, setDrafts] = useState({})

  const keyOf = (s) => s.member + '|' + s.sprint
  const baseOf = (s) => ({ committed: s.committed, completed: s.completed, targetIdeas: s.targetIdeas || 0, comments: s.comments || '' })
  const draftFor = (s) => drafts[keyOf(s)] || baseOf(s)
  function changeRow(s, field, val) {
    const k = keyOf(s)
    setDrafts((prev) => ({ ...prev, [k]: { ...(prev[k] || baseOf(s)), [field]: val } }))
  }
  function rowDirty(s) {
    const d = drafts[keyOf(s)]
    if (!d) return false
    return Number(d.committed) !== s.committed || Number(d.completed) !== s.completed
      || Number(d.targetIdeas) !== (s.targetIdeas || 0) || (d.comments || '') !== (s.comments || '')
  }

  const podMemberIds = podF ? members.filter((m) => m.pod === podF).map((m) => m.id) : null
  const filtered = podMemberIds ? sprints.filter((s) => podMemberIds.indexOf(s.member) >= 0) : sprints
  // Natural (numeric-aware) order so "Sprint 9" comes before "Sprint 10".
  const sprintCmp = (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
  const spNames = [...new Set(filtered.map((s) => s.sprint))].sort(sprintCmp)

  useEffect(() => {
    if (spNames.length && !spNames.includes(active)) setActive(spNames[0])
    if (!spNames.length && active) setActive('')
  }, [spNames.join('|')]) // eslint-disable-line react-hooks/exhaustive-deps

  const tC = filtered.reduce((a, b) => a + b.committed, 0)
  const tD = filtered.reduce((a, b) => a + b.completed, 0)
  const pct = tC ? Math.round((tD / tC) * 100) : 0
  const rateCol = pct >= 80 ? 'var(--green)' : pct >= 50 ? 'var(--amber)' : 'var(--red)'
  const podLabel = podF ? ` (${podF})` : ''

  function openAdd() {
    // Pre-seed the modal POD with the page filter. Per-member numbers are
    // entered in the grid, not here.
    setForm({ pod: podF, sprint: '', comments: '' })
  }
  async function saveRow(s, vals) {
    const ok = await run(() => api.upsertSprint({
      member: s.member, sprint: s.sprint,
      committed: parseFloat(vals.committed) || 0,
      completed: parseFloat(vals.completed) || 0,
      targetIdeas: parseFloat(vals.targetIdeas) || 0,
      comments: vals.comments,
    }), 'Sprint entry updated')
    if (ok) setDrafts((prev) => { const n = { ...prev }; delete n[keyOf(s)]; return n })
  }
  // Save every edited row in one batch (across all sprints).
  async function saveAll() {
    const dirty = sprints.filter(rowDirty)
    if (!dirty.length) { toast('No unsaved changes', 'i'); return }
    const rows = dirty.map((s) => {
      const d = draftFor(s)
      return { member: s.member, sprint: s.sprint, committed: parseFloat(d.committed) || 0, completed: parseFloat(d.completed) || 0, targetIdeas: parseFloat(d.targetIdeas) || 0, comments: d.comments }
    })
    try {
      const res = await api.bulkSprints(rows)
      await loadAll()
      setDrafts({})
      const n = (res.created || 0) + (res.updated || 0)
      toast(`Saved ${n} entr${n === 1 ? 'y' : 'ies'}`, 's')
    } catch (e) { toast('Error: ' + e.message, 'e') }
  }
  function setFormPod(pod) { setForm({ ...form, pod }) }
  const podOptionsSprint = [<option key="" value="">All PODs</option>].concat(
    data.pods.map((p) => <option key={p.code} value={p.code}>{p.name}</option>),
  )
  // Add every member in the chosen POD to the sprint with zero values; the
  // actual Committed/Completed/Idea Target are then entered in the grid.
  async function submit() {
    const sprint = form.sprint.trim()
    if (!sprint) { toast('Sprint / Month is required', 'e'); return }
    const pool = members.filter((m) => !form.pod || m.pod === form.pod)
    if (!pool.length) { toast('No members in the selected POD', 'e'); return }
    const have = new Set(sprints.filter((s) => s.sprint === sprint).map((s) => s.member))
    const toAdd = pool.filter((m) => !have.has(m.id))
    if (!toAdd.length) { toast(`All members already in ${sprint}`, 'i'); setForm(null); setActive(sprint); return }
    try {
      for (const m of toAdd) {
        await api.upsertSprint({ member: m.id, sprint, committed: 0, completed: 0, targetIdeas: 0, comments: form.comments || '' })
      }
      await loadAll()
      toast(`Added ${toAdd.length} member(s) to ${sprint}`, 's')
      setForm(null)
      setActive(sprint)
    } catch (e) {
      toast('Error: ' + e.message, 'e')
    }
  }
  function del(s) {
    const m = memberByID(members, s.member)
    if (!window.confirm(`Delete ${m ? m.name : s.member}'s "${s.sprint}" sprint entry?`)) return
    run(() => api.deleteSprint(s.member, s.sprint), 'Sprint entry deleted')
  }
  function delSprint(name) {
    const n = sprints.filter((s) => s.sprint === name).length
    if (!window.confirm(`Delete the entire "${name}" sprint and all ${n} member entries? This cannot be undone.`)) return
    run(() => api.deleteSprintByName(name), `Sprint "${name}" deleted`)
  }
  async function submitRename() {
    const nv = (rename.value || '').trim()
    if (!nv) { toast('New sprint name is required', 'e'); return }
    if (nv === rename.old) { setRename(null); return }
    const ok = await run(() => api.renameSprint(rename.old, nv), `Sprint renamed to "${nv}"`)
    if (ok) { setRename(null); setActive(nv) }
  }

  // Detail rows for the active sprint
  let detail = sprints.filter((s) => s.sprint === active && (!podMemberIds || podMemberIds.indexOf(s.member) >= 0))
  detail = detail.slice().sort((a, b) => {
    const ma = memberByID(members, a.member); const mb = memberByID(members, b.member)
    return (ma ? ma.name : '').localeCompare(mb ? mb.name : '')
  })
  const dC = detail.reduce((a, b) => a + b.committed, 0)
  const dD = detail.reduce((a, b) => a + b.completed, 0)
  // Average completion across every member in the sprint (members with no data
  // count as 0%), so filling one of N members doesn't show a full bar.
  const dPct = detail.length
    ? Math.round(detail.reduce((a, s) => a + (s.committed ? Math.min(100, (s.completed / s.committed) * 100) : 0), 0) / detail.length)
    : 0

  const dirtyCount = sprints.filter(rowDirty).length

  return (
    <>
      <div className="tb"><h2>Sprint Tracker</h2>
        <div className="tb-r">
          <PodFilter value={podF} onChange={setPodF} />
          {isAdmin && <button className="btn btn-p btn-sm" disabled={!dirtyCount} title="Save all edited rows" onClick={saveAll}>&#128190; Save All{dirtyCount ? ` (${dirtyCount})` : ''}</button>}
          <button className="btn btn-sm" onClick={openAdd}>+ Add Entry</button>
          {isAdmin && <BulkUpload kind="sprint" pod={podF} />}
          <button className="btn btn-sm" onClick={() => exportCSV('sprints', data)}>&#8659; CSV</button>
          <button className="btn btn-sm btn-g" onClick={() => exportPDF(data)}>&#8659; PDF</button>
        </div>
      </div>
      <div className="con">
        {!filtered.length ? <Empty>{podF ? `No sprint data for ${podF} POD yet.` : 'No sprint entries yet. Click + Add Entry to begin.'}</Empty> : (
          <>
            <div className="g3" style={{ marginBottom: 14 }}>
              <div className="mc"><div className="mc-l">Committed SP{podLabel}</div><div className="mc-v" style={{ color: 'var(--blue)' }}>{tC}</div><div className="mc-s">Across {spNames.length} sprint(s)</div></div>
              <div className="mc"><div className="mc-l">Completed SP{podLabel}</div><div className="mc-v" style={{ color: 'var(--green)' }}>{tD}</div><div className="mc-s">{pct}% delivery rate</div></div>
              <div className="mc"><div className="mc-l">Completion Rate</div><div className="mc-v" style={{ color: rateCol }}>{pct}%</div><div className="mc-pb"><div className="mc-pf" style={{ width: pct + '%', background: rateCol }} /></div></div>
            </div>
            <div style={{ marginBottom: 14 }}>
              {spNames.map((sp) => (
                <span key={sp} className={'stab' + (sp === active ? ' active' : '')} onClick={() => setActive(sp)}>{sp}</span>
              ))}
            </div>
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{active}</div>
                  <div style={{ fontSize: 11, color: 'var(--mu)', marginTop: 2 }}>{detail.length} members | {dC} committed | {dD} completed | {dPct}% avg completion</div>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span className="badge bb">{dC} Committed</span>
                  <span className="badge bg">{dD} Completed</span>
                  {isAdmin && <button className="btn btn-sm" onClick={() => setRename({ old: active, value: active })}>&#9998; Edit Sprint</button>}
                  {isAdmin && <button className="btn btn-sm btn-d" onClick={() => delSprint(active)}>&#128465; Delete Sprint</button>}
                </div>
              </div>
              <div className="pbar" style={{ height: 8, marginBottom: 14 }}><div className="pbar-f" style={{ width: dPct + '%', background: 'var(--green)' }} /></div>
              <div className="tw"><table>
                <thead><tr>
                  <th>Member</th><th>POD</th>
                  <th style={{ background: 'rgba(59,130,246,.08)', color: 'var(--blue)' }}>Committed SP</th>
                  <th style={{ background: 'rgba(34,197,94,.08)', color: 'var(--green)' }}>Completed SP</th>
                  <th>Completion</th><th>Idea Target</th><th>Comments</th>
                  {isAdmin && <th>Actions</th>}
                </tr></thead>
                <tbody>
                  {detail.map((s) => (
                    <SprintRow key={s.member + '|' + s.sprint} s={s} members={members} pods={data.pods} isAdmin={isAdmin}
                      draft={draftFor(s)} onChange={(f, v) => changeRow(s, f, v)} onSave={saveRow} onDelete={del} />
                  ))}
                </tbody>
              </table></div>
            </div>
          </>
        )}
      </div>

      <Modal open={!!form} title="Add Sprint" onClose={() => setForm(null)}
        footer={<><button className="btn" onClick={() => setForm(null)}>Cancel</button><button className="btn btn-p" onClick={submit}>Add to Sprint</button></>}>
        {form && <>
          <div className="fg2">
            <Field label="POD / Team"><select value={form.pod} onChange={(e) => setFormPod(e.target.value)}>{podOptionsSprint}</select></Field>
            <Field label="Sprint / Month"><input value={form.sprint} placeholder="e.g. Jun'26" onChange={(e) => setForm({ ...form, sprint: e.target.value })} /></Field>
          </div>
          <Field label="Comments (optional, applied to new rows)"><input value={form.comments} placeholder="Optional notes" onChange={(e) => setForm({ ...form, comments: e.target.value })} /></Field>
          <div style={{ fontSize: 11, color: 'var(--mu)', marginTop: 4 }}>
            Adds every member{form.pod ? ` in ${form.pod}` : ''} to this sprint with zero values. Enter Committed / Completed / Idea Target for each in the grid below.
          </div>
        </>}
      </Modal>

      <Modal open={!!rename} title="Edit Sprint" onClose={() => setRename(null)}
        footer={<><button className="btn" onClick={() => setRename(null)}>Cancel</button><button className="btn btn-p" onClick={submitRename}>Save</button></>}>
        {rename && <>
          <Field label="Sprint / Month name"><input value={rename.value} placeholder="e.g. Jan'26" onChange={(e) => setRename({ ...rename, value: e.target.value })} /></Field>
          <div style={{ fontSize: 11, color: 'var(--mu)', marginTop: 4 }}>
            Renames “{rename.old}” for all its members and re-maps any ideas pointing to it. Members already in the new sprint are skipped.
          </div>
        </>}
      </Modal>
    </>
  )
}
