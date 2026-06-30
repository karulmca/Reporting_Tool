import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { DndContext, closestCorners, closestCenter, PointerSensor, useSensor, useSensors, useDroppable } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useApp } from '../store'
import { Avatar, Modal, Field, Empty } from './ui'
import CustomFieldInputs from './CustomFieldInputs'
import { memberByID, memberName, podColor } from '../lib/helpers'
import { exportBoardExcel } from '../lib/reportExport'

const PRIORITIES = ['Critical', 'High', 'Medium', 'Low']
const PRIO_COLOR = { Critical: '#ef4444', High: '#f97316', Medium: '#f59e0b', Low: '#22c55e' }
const LANE_FIELD = { assignee: 'assignee', pod: 'pod', priority: 'priority', type: 'type_id' }
const ALL = '__all__'
const NONE = '__none__'

export default function ScrumBoard({ onNav }) {
  const { data, isAdmin, api, toast } = useApp()
  const { board, members, pods } = data
  const frameworks = board.frameworks || []
  const fwById = useMemo(() => Object.fromEntries(frameworks.map((f) => [f.id, f])), [frameworks])
  const wiFields = data.customFields.workitem || []

  const [pod, setPod] = useState('')
  const [sprint, setSprint] = useState('')
  const [items, setItems] = useState([])
  const [q, setQ] = useState('')
  const [typeF, setTypeF] = useState('')
  const [edit, setEdit] = useState(null)
  const [exporting, setExporting] = useState(false)
  const [view, setView] = useState('board')          // 'board' | 'backlog'
  const [backlogSprint, setBacklogSprint] = useState('__all__')

  async function downloadExcel() {
    setExporting(true)
    try {
      const exportItems = (usesSprints && sprint) ? items.filter((i) => i.sprint === sprint) : items
      await exportBoardExcel({ items: exportItems, columns, types, members, wiFields, framework, sprint: usesSprints ? sprint : '', pod })
      toast('Board exported to Excel', 's')
    } catch (e) { toast('Export failed: ' + e.message, 'e') } finally { setExporting(false) }
  }

  useEffect(() => { if (!pod && pods.length) setPod(pods[0].code) }, [pods, pod])

  // The selected POD's framework drives columns / types / swimlane / cadence.
  const podObj = pods.find((p) => p.code === pod)
  const framework = podObj ? fwById[podObj.framework_id] : null
  const columns = (framework && framework.columns) || []
  const colIds = new Set(columns.map((c) => c.id))
  // Items created under a different framework point at a column not on this
  // board; surface them in the first column so they're visible (dragging them
  // persists a valid column for the current framework).
  const effCol = (it) => (colIds.has(it.column_id) ? it.column_id : (columns[0] ? columns[0].id : ''))
  const types = (framework && framework.types) || []
  const typeMap = useMemo(() => Object.fromEntries(types.map((t) => [t.id, t])), [types])
  const swimlane = (framework && framework.swimlane) || ''
  const usesSprints = framework ? framework.uses_sprints : true
  const iterLabel = (framework && framework.iteration_label) || 'Sprint'
  const laneField = LANE_FIELD[swimlane]

  const load = useCallback(async () => {
    if (!pod) { setItems([]); return }
    try { setItems(await api.getWorkItems('', pod)) } catch { toast('Failed to load board', 'e') }
  }, [pod]) // eslint-disable-line
  useEffect(() => { load() }, [load])

  // Iteration options = the POD's configured iterations ∪ sprints already on items.
  const iterOptions = useMemo(() => {
    const base = (board.iterations && board.iterations[pod]) || []
    const fromItems = [...new Set(items.map((i) => i.sprint))].filter(Boolean)
    return [...new Set([...base, ...fromItems])]
  }, [board.iterations, pod, items])
  useEffect(() => {
    if (!usesSprints) { if (sprint) setSprint(''); return }
    if (!sprint && iterOptions.length) setSprint(iterOptions[iterOptions.length - 1])
  }, [usesSprints, iterOptions]) // eslint-disable-line

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const filtered = useMemo(() => items.filter((i) =>
    (!usesSprints || !sprint || i.sprint === sprint)
    && (!typeF || i.type_id === typeF)
    && (!q.trim() || (i.title || '').toLowerCase().includes(q.trim().toLowerCase()) || (i.tags || '').toLowerCase().includes(q.trim().toLowerCase()))
  ), [items, typeF, q, sprint, usesSprints])

  // Backlog: POD items (type/search filtered) scoped by the backlog sprint
  // filter, ordered by rank (priority).
  const backlogItems = useMemo(() => {
    let r = items.filter((i) => (!typeF || i.type_id === typeF)
      && (!q.trim() || (i.title || '').toLowerCase().includes(q.trim().toLowerCase()) || (i.tags || '').toLowerCase().includes(q.trim().toLowerCase())))
    if (backlogSprint === '__none__') r = r.filter((i) => !i.sprint)
    else if (backlogSprint !== '__all__') r = r.filter((i) => i.sprint === backlogSprint)
    return r.slice().sort((a, b) => a.rank - b.rank)
  }, [items, typeF, q, backlogSprint])

  async function assignSprint(it, sp) {
    setItems((list) => list.map((i) => (i.id === it.id ? { ...i, sprint: sp } : i)))
    try { await api.updateWorkItem(it.id, { sprint: sp }) } catch (e) { toast('Error: ' + e.message, 'e'); load() }
  }
  async function backlogReorder(activeId, overId) {
    const list = backlogItems
    const oldIdx = list.findIndex((i) => i.id === activeId)
    const newIdx = list.findIndex((i) => i.id === overId)
    if (oldIdx < 0 || newIdx < 0 || oldIdx === newIdx) return
    const reordered = arrayMove(list, oldIdx, newIdx)
    const prev = reordered[newIdx - 1]; const next = reordered[newIdx + 1]
    const newRank = (!prev && !next) ? 0 : !prev ? next.rank - 1 : !next ? prev.rank + 1 : (prev.rank + next.rank) / 2
    setItems((l) => l.map((i) => (i.id === activeId ? { ...i, rank: newRank } : i)))
    try { await api.moveWorkItem(activeId, { rank: newRank }) } catch (e) { toast('Reorder failed: ' + e.message, 'e'); load() }
  }

  const laneLabel = (v) => {
    if (!v) return '(Unassigned)'
    if (swimlane === 'assignee') return memberName(members, v)
    if (swimlane === 'type') return (typeMap[v] && typeMap[v].name) || v
    return v
  }
  const lanes = useMemo(() => {
    if (!swimlane) return [{ key: ALL, raw: ALL, label: null }]
    const vals = [...new Set(filtered.map((i) => i[laneField] || ''))]
    return vals.sort().map((v) => ({ key: v || NONE, raw: v, label: laneLabel(v) }))
  }, [swimlane, filtered]) // eslint-disable-line

  const laneRawOf = (item) => (swimlane ? (item[laneField] || '') : ALL)
  const cardsIn = (laneRaw, colId) => filtered
    .filter((i) => effCol(i) === colId && (swimlane ? (i[laneField] || '') === laneRaw : true))
    .sort((a, b) => a.rank - b.rank)

  async function onDragEnd(e) {
    const { active, over } = e
    if (!over) return
    const aId = Number(active.id)
    const a = items.find((i) => i.id === aId)
    if (!a) return
    let targetCol; let targetLaneRaw
    const o = String(over.id)
    if (o.includes('|')) {
      const [laneKey, colId] = o.split('|')
      targetCol = colId
      targetLaneRaw = laneKey === ALL ? ALL : laneKey === NONE ? '' : laneKey
    } else {
      const ov = items.find((i) => i.id === Number(o))
      if (!ov) return
      targetCol = effCol(ov)
      targetLaneRaw = laneRawOf(ov)
    }
    const sameCol = effCol(a) === targetCol
    const laneChanged = swimlane && targetLaneRaw !== ALL && (a[laneField] || '') !== targetLaneRaw
    if (sameCol && !laneChanged && String(over.id) === String(active.id)) return

    const peers = items.filter((i) => i.id !== aId && effCol(i) === targetCol
      && (swimlane && targetLaneRaw !== ALL ? (i[laneField] || '') === targetLaneRaw : true))
      .sort((x, y) => x.rank - y.rank)
    let idx = peers.length
    if (!o.includes('|')) { const k = peers.findIndex((i) => i.id === Number(o)); if (k >= 0) idx = k }
    const prev = peers[idx - 1]; const next = peers[idx]
    let newRank
    if (!prev && !next) newRank = 0
    else if (!prev) newRank = next.rank - 1
    else if (!next) newRank = prev.rank + 1
    else newRank = (prev.rank + next.rank) / 2

    const patch = { column_id: targetCol, rank: newRank }
    if (laneChanged) patch[laneField] = targetLaneRaw
    setItems((list) => list.map((i) => (i.id === aId ? { ...i, ...patch } : i)))
    try {
      await api.moveWorkItem(aId, { column_id: targetCol, rank: newRank })
      if (laneChanged) await api.updateWorkItem(aId, { [laneField]: targetLaneRaw })
    } catch (err) { toast('Move failed: ' + err.message, 'e'); load() }
  }

  const blank = (colId) => ({
    id: null, title: '', type_id: types[0] ? types[0].id : '', column_id: colId || (columns[0] ? columns[0].id : ''),
    assignee: '', priority: 'Medium', story_points: 0, tags: '', description: '', acceptance: '',
    sprint: usesSprints ? sprint : '', pod, custom: {},
  })
  async function saveItem() {
    if (!edit.title.trim()) { toast('Title is required', 'e'); return }
    const payload = { ...edit, title: edit.title.trim(), story_points: parseFloat(edit.story_points) || 0 }
    try {
      if (edit.id) await api.updateWorkItem(edit.id, payload)
      else await api.createWorkItem(payload)
      setEdit(null); toast('Saved', 's'); load()
    } catch (e) { toast('Error: ' + e.message, 'e') }
  }
  async function delItem(id) {
    if (!window.confirm('Delete this work item?')) return
    try { await api.deleteWorkItem(id); setEdit(null); toast('Deleted', 's'); load() } catch (e) { toast('Error: ' + e.message, 'e') }
  }

  if (!frameworks.length || !pods.length) {
    return (
      <>
        <div className="tb"><h2>Scrum Board</h2></div>
        <div className="con"><Empty>{!pods.length ? 'No PODs defined yet.' : 'No frameworks configured.'}{isAdmin && <> <button className="btn btn-sm" onClick={() => onNav('board-settings')}>Configure</button></>}</Empty></div>
      </>
    )
  }

  const totalPts = (laneRaw, col) => cardsIn(laneRaw, col.id).reduce((a, i) => a + (i.story_points || 0), 0)

  return (
    <>
      <div className="tb"><h2>Scrum Board {framework && <span style={{ fontSize: 12, color: 'var(--mu)', fontWeight: 400 }}>· {framework.name}</span>}</h2>
        <div className="tb-r">
          <select value={pod} onChange={(e) => { setPod(e.target.value); setSprint('') }} style={{ width: 'auto' }}>
            {pods.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
          </select>
          <span className={'stab' + (view === 'board' ? ' active' : '')} onClick={() => setView('board')}>Board</span>
          <span className={'stab' + (view === 'backlog' ? ' active' : '')} onClick={() => setView('backlog')}>Backlog</span>
          {view === 'board' && usesSprints && (
            <select value={sprint} onChange={(e) => setSprint(e.target.value)} style={{ width: 'auto' }} title={iterLabel}>
              {!iterOptions.length && <option value="">No {iterLabel.toLowerCase()}s</option>}
              {iterOptions.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
          {view === 'board' && !usesSprints && <span className="badge" style={{ background: 'var(--s3)', color: 'var(--mu2)' }}>Continuous flow</span>}
          <select value={typeF} onChange={(e) => setTypeF(e.target.value)} style={{ width: 'auto' }}>
            <option value="">All Types</option>
            {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 150 }} />
          {isAdmin && columns.length > 0 && <button className="btn btn-p btn-sm" onClick={() => setEdit(blank())}>+ New Item</button>}
          <button className="btn btn-sm" disabled={exporting || !items.length} title="Download board (styled, with charts)" onClick={downloadExcel}>{exporting ? '…' : '⤓ Excel'}</button>
          {isAdmin && <button className="btn btn-sm" title="Configure board" onClick={() => onNav('board-settings')}>&#9881; Configure</button>}
        </div>
      </div>

      <div className="con" style={{ overflowX: 'auto' }}>
        {!framework ? <Empty>This POD has no framework assigned.{isAdmin && ' Assign one in Board Settings.'}</Empty>
          : view === 'backlog' ? (
            <Backlog items={backlogItems} columns={columns} typeMap={typeMap} members={members}
              usesSprints={usesSprints} iterOptions={iterOptions} sprintFilter={backlogSprint} setSprintFilter={setBacklogSprint}
              onReorder={backlogReorder} onAssign={assignSprint} onCard={(it) => setEdit({ ...it, custom: { ...(it.custom || {}) } })}
              isAdmin={isAdmin} onAdd={() => setEdit({ ...blank(), sprint: (usesSprints && backlogSprint !== '__all__' && backlogSprint !== '__none__') ? backlogSprint : '' })} />
          )
          : !columns.length ? <Empty>Framework “{framework.name}” has no columns.{isAdmin && ' Add columns in Board Settings.'}</Empty>
          : usesSprints && !sprint ? <Empty>Select a {iterLabel.toLowerCase()} to view the board.</Empty> : (
          <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={onDragEnd}>
            {/* Column headers */}
            <div style={{ display: 'flex', gap: 12, minWidth: columns.length * 272 }}>
              {columns.map((col) => {
                const count = filtered.filter((i) => effCol(i) === col.id).length
                const over = col.wip_limit > 0 && count > col.wip_limit
                return (
                  <div key={col.id} style={{ width: 260, flex: '0 0 260px', display: 'flex', alignItems: 'center', gap: 8, padding: '6px 4px', borderBottom: `2px solid ${col.color}` }}>
                    <span style={{ width: 9, height: 9, borderRadius: '50%', background: col.color }} />
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{col.name}</span>
                    <span className="badge" style={{ background: over ? 'rgba(239,68,68,.18)' : 'var(--s3)', color: over ? '#fca5a5' : 'var(--mu2)' }}>
                      {count}{col.wip_limit > 0 ? ` / ${col.wip_limit}` : ''}
                    </span>
                    {col.is_done && <span className="badge bg" style={{ fontSize: 9 }}>done</span>}
                  </div>
                )
              })}
            </div>

            {/* Lanes */}
            {lanes.map((lane) => (
              <div key={lane.key} style={{ marginTop: 10 }}>
                {lane.label != null && (
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--mu2)', textTransform: 'uppercase', letterSpacing: '.05em', margin: '6px 2px' }}>{lane.label}</div>
                )}
                <div style={{ display: 'flex', gap: 12, minWidth: columns.length * 272, alignItems: 'flex-start' }}>
                  {columns.map((col) => (
                    <ColumnCell key={col.id} laneKey={lane.key} col={col}
                      cards={cardsIn(lane.raw === ALL ? ALL : lane.raw, col.id)} pts={totalPts(lane.raw === ALL ? ALL : lane.raw, col)}
                      members={members} pods={pods} typeMap={typeMap} wiFields={wiFields}
                      isAdmin={isAdmin} onCard={(it) => setEdit({ ...it, custom: { ...(it.custom || {}) } })}
                      onAdd={() => { const b = blank(col.id); if (swimlane && laneField && lane.raw !== ALL) b[laneField] = lane.raw; setEdit(b) }} />
                  ))}
                </div>
              </div>
            ))}
          </DndContext>
        )}
      </div>

      <CardModal edit={edit} setEdit={setEdit} onSave={saveItem} onDelete={delItem} onChanged={load}
        columns={columns} types={types} members={members} pods={pods} wiFields={wiFields} sprint={sprint} isAdmin={isAdmin} />
    </>
  )
}

function ColumnCell({ laneKey, col, cards, pts, members, pods, typeMap, wiFields, isAdmin, onCard, onAdd }) {
  const { setNodeRef, isOver } = useDroppable({ id: `${laneKey}|${col.id}` })
  return (
    <div ref={setNodeRef} style={{
      width: 260, flex: '0 0 260px', minHeight: 80, background: isOver ? 'var(--s3)' : 'var(--s1)',
      border: '1px solid var(--b1)', borderRadius: 10, padding: 8, transition: 'background .12s',
    }}>
      <SortableContext items={cards.map((c) => String(c.id))} strategy={verticalListSortingStrategy}>
        {cards.map((it) => (
          <SortableCard key={it.id} item={it} members={members} pods={pods} typeMap={typeMap} wiFields={wiFields} onClick={() => onCard(it)} />
        ))}
      </SortableContext>
      {!cards.length && <div style={{ color: 'var(--mu)', fontSize: 11, textAlign: 'center', padding: '14px 0' }}>—</div>}
      {isAdmin && <button className="btn btn-sm" style={{ width: '100%', marginTop: 6 }} onClick={onAdd}>+ Add</button>}
      {pts > 0 && <div style={{ fontSize: 10, color: 'var(--mu)', textAlign: 'right', marginTop: 4 }}>{pts} pts</div>}
    </div>
  )
}

function SortableCard({ item, members, pods, typeMap, wiFields, onClick }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: String(item.id) })
  const t = typeMap[item.type_id]
  const sub = memberByID(members, item.assignee)
  const onCardFields = (wiFields || []).filter((f) => f.on_card && (item.custom || {})[f.id])
  const style = {
    transform: CSS.Transform.toString(transform), transition,
    opacity: isDragging ? 0.5 : 1, cursor: 'grab',
    background: 'var(--s2)', border: '1px solid var(--b1)', borderLeft: `3px solid ${t ? t.color : '#64748b'}`,
    borderRadius: 8, padding: '8px 10px', marginBottom: 8,
  }
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} onClick={onClick}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
        {t && <span className="badge" style={{ background: t.color + '22', color: t.color, fontSize: 9 }}>{t.name}</span>}
        <span style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--mu)', fontFamily: 'var(--mono)' }}>#{item.id}</span>
      </div>
      <div style={{ fontSize: 12.5, fontWeight: 500, lineHeight: 1.35 }}>{item.title}</div>
      {!!(item.tags || '').trim() && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 5 }}>
          {item.tags.split(',').map((tg) => tg.trim()).filter(Boolean).map((tg, k) => (
            <span key={k} className="badge" style={{ background: 'var(--s3)', color: 'var(--mu2)', fontSize: 9 }}>{tg}</span>
          ))}
        </div>
      )}
      {onCardFields.map((f) => <div key={f.id} style={{ fontSize: 10, color: 'var(--mu2)', marginTop: 4 }}>{f.label}: {item.custom[f.id]}</div>)}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 7 }}>
        <span title={item.priority} style={{ width: 8, height: 8, borderRadius: '50%', background: PRIO_COLOR[item.priority] || '#64748b' }} />
        {item.story_points > 0 && <span className="badge" style={{ background: 'var(--s3)', color: 'var(--mu2)', fontSize: 9 }}>{item.story_points} SP</span>}
        {item.updates_count > 0 && <span className="badge" style={{ background: 'var(--s3)', color: 'var(--mu2)', fontSize: 9 }} title={'Last update: ' + (item.last_update || '')}>&#128172; {item.updates_count}</span>}
        <span style={{ marginLeft: 'auto' }}>
          {sub ? <Avatar members={members} name={sub.name} size={22} title={sub.name} />
            : <span style={{ fontSize: 10, color: 'var(--mu)' }}>{item.assignee || 'Unassigned'}</span>}
        </span>
      </div>
    </div>
  )
}

function CardModal({ edit, setEdit, onSave, onDelete, columns, types, members, pods, wiFields, sprint, isAdmin, onChanged }) {
  const { api, toast } = useApp()
  const itemId = edit && edit.id
  const today = new Date().toISOString().slice(0, 10)
  const [updates, setUpdates] = useState([])
  const [draft, setDraft] = useState({ date: today, note: '', author: '', remaining: '' })

  useEffect(() => {
    if (!itemId) { setUpdates([]); return }
    setDraft({ date: today, note: '', author: (edit && edit.assignee) || '', remaining: '' })
    api.getItemUpdates(itemId).then(setUpdates).catch(() => {})
  }, [itemId]) // eslint-disable-line

  if (!edit) return null
  const set = (patch) => setEdit({ ...edit, ...patch })
  const pool = members.filter((m) => !edit.pod || m.pod === edit.pod)

  async function addUpdate() {
    if (!draft.note.trim()) { toast('Update note required', 'e'); return }
    try {
      const u = await api.addItemUpdate(itemId, { date: draft.date || today, note: draft.note.trim(), author: draft.author, remaining: parseFloat(draft.remaining) || 0 })
      setUpdates((list) => [u, ...list])
      setDraft({ ...draft, note: '', remaining: '' })
      if (onChanged) onChanged()
    } catch (e) { toast('Error: ' + e.message, 'e') }
  }
  async function removeUpdate(uid) {
    try { await api.deleteItemUpdate(uid); setUpdates((list) => list.filter((u) => u.id !== uid)); if (onChanged) onChanged() }
    catch (e) { toast('Error: ' + e.message, 'e') }
  }

  return (
    <Modal open={!!edit} width="660px" title={edit.id ? `Work Item #${edit.id}` : 'New Work Item'} onClose={() => setEdit(null)}
      footer={<>
        {edit.id && isAdmin && <button className="btn btn-d" style={{ marginRight: 'auto' }} onClick={() => onDelete(edit.id)}>Delete</button>}
        <button className="btn" onClick={() => setEdit(null)}>Cancel</button>
        <button className="btn btn-p" onClick={onSave}>Save</button>
      </>}>
      <Field label="Title"><input value={edit.title} placeholder="Work item title" onChange={(e) => set({ title: e.target.value })} /></Field>
      <div className="fg3">
        <Field label="Type"><select value={edit.type_id} onChange={(e) => set({ type_id: e.target.value })}>{types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
        <Field label="State / Column"><select value={edit.column_id} onChange={(e) => set({ column_id: e.target.value })}>{columns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <Field label="Priority"><select value={edit.priority} onChange={(e) => set({ priority: e.target.value })}>{PRIORITIES.map((p) => <option key={p}>{p}</option>)}</select></Field>
      </div>
      <div className="fg3">
        <Field label="POD"><select value={edit.pod} onChange={(e) => set({ pod: e.target.value, assignee: '' })}><option value="">(none)</option>{pods.map((p) => <option key={p.code} value={p.code}>{p.code}</option>)}</select></Field>
        <Field label="Assignee"><select value={edit.assignee} onChange={(e) => set({ assignee: e.target.value })}><option value="">Unassigned</option>{pool.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></Field>
        <Field label="Story Points"><input type="number" min="0" step="0.5" value={edit.story_points} onChange={(e) => set({ story_points: e.target.value })} /></Field>
      </div>
      <CustomFieldInputs fields={wiFields} values={edit.custom} onChange={(id, v) => set({ custom: { ...edit.custom, [id]: v } })} />
      <Field label="Tags (comma sep.)"><input value={edit.tags} placeholder="frontend, urgent" onChange={(e) => set({ tags: e.target.value })} /></Field>
      <Field label="Description"><textarea style={{ minHeight: 70 }} value={edit.description} onChange={(e) => set({ description: e.target.value })} /></Field>
      <Field label="Acceptance Criteria"><textarea value={edit.acceptance} onChange={(e) => set({ acceptance: e.target.value })} /></Field>

      {/* Daily updates */}
      <div className="dv" />
      <div className="sh" style={{ marginBottom: 8 }}>Daily Updates</div>
      {!itemId ? (
        <div style={{ fontSize: 12, color: 'var(--mu)' }}>Save the work item first, then you can log daily updates.</div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ width: 130 }}><label className="fl">Date</label><input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} /></div>
            <div style={{ width: 150 }}><label className="fl">By</label>
              <select value={draft.author} onChange={(e) => setDraft({ ...draft, author: e.target.value })}>
                <option value="">—</option>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div style={{ width: 110 }}><label className="fl">Remaining</label><input type="number" min="0" step="0.5" value={draft.remaining} placeholder="SP/hrs" onChange={(e) => setDraft({ ...draft, remaining: e.target.value })} /></div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginTop: 8 }}>
            <div style={{ flex: 1 }}><label className="fl">Update</label><input value={draft.note} placeholder="What progressed today / blockers…" onChange={(e) => setDraft({ ...draft, note: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') addUpdate() }} /></div>
            <button className="btn btn-p btn-sm" onClick={addUpdate}>+ Add</button>
          </div>
          <div style={{ marginTop: 10, maxHeight: 200, overflowY: 'auto' }}>
            {updates.length ? updates.map((u) => (
              <div key={u.id} style={{ display: 'flex', gap: 8, padding: '7px 0', borderBottom: '1px solid var(--b1)' }}>
                <span style={{ fontSize: 11, color: 'var(--mu2)', fontFamily: 'var(--mono)', whiteSpace: 'nowrap' }}>{u.date}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5 }}>{u.note}</div>
                  <div style={{ fontSize: 10, color: 'var(--mu)' }}>
                    {u.author ? memberName(members, u.author) : 'Unknown'}{u.remaining ? ` · ${u.remaining} remaining` : ''}
                  </div>
                </div>
                {isAdmin && <button className="btn btn-sm btn-d" onClick={() => removeUpdate(u.id)}>X</button>}
              </div>
            )) : <div style={{ fontSize: 12, color: 'var(--mu)' }}>No updates yet.</div>}
          </div>
        </>
      )}
      <div style={{ fontSize: 11, color: 'var(--mu)', marginTop: 8 }}>Sprint: {sprint || '—'}</div>
    </Modal>
  )
}

// ---- Backlog: ranked, drag-to-prioritise list with sprint assignment -------
function Backlog({ items, columns, typeMap, members, usesSprints, iterOptions, sprintFilter, setSprintFilter, onReorder, onAssign, onCard, onAdd, isAdmin }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const colName = (id) => { const c = columns.find((x) => x.id === id); return c ? c.name : '—' }
  return (
    <>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        {usesSprints && (
          <select value={sprintFilter} onChange={(e) => setSprintFilter(e.target.value)} style={{ width: 'auto' }}>
            <option value="__all__">All items</option>
            <option value="__none__">Backlog (unassigned)</option>
            {iterOptions.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
        <span style={{ fontSize: 12, color: 'var(--mu)' }}>{items.length} item{items.length === 1 ? '' : 's'} · drag to re-prioritise</span>
        {isAdmin && <button className="btn btn-p btn-sm" style={{ marginLeft: 'auto' }} onClick={onAdd}>+ Add Item</button>}
      </div>
      {!items.length ? <Empty>No backlog items.</Empty> : (
        <DndContext sensors={sensors} collisionDetection={closestCenter}
          onDragEnd={(e) => { if (e.over && e.active.id !== e.over.id) onReorder(Number(e.active.id), Number(e.over.id)) }}>
          <SortableContext items={items.map((i) => String(i.id))} strategy={verticalListSortingStrategy}>
            <div className="card" style={{ padding: 6 }}>
              {items.map((it, idx) => (
                <SortableBacklogRow key={it.id} item={it} idx={idx} colName={colName} typeMap={typeMap} members={members}
                  usesSprints={usesSprints} iterOptions={iterOptions} onAssign={onAssign} onCard={onCard} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </>
  )
}

function SortableBacklogRow({ item, idx, colName, typeMap, members, usesSprints, iterOptions, onAssign, onCard }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: String(item.id) })
  const t = typeMap[item.type_id]
  const sub = memberByID(members, item.assignee)
  const style = {
    transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1,
    display: 'flex', alignItems: 'center', gap: 9, padding: '8px 6px', borderBottom: '1px solid var(--b1)',
    background: isDragging ? 'var(--s3)' : 'transparent',
  }
  return (
    <div ref={setNodeRef} style={style}>
      <span {...attributes} {...listeners} title="Drag to re-prioritise" style={{ cursor: 'grab', color: 'var(--mu)', userSelect: 'none' }}>⠿</span>
      <span style={{ width: 22, textAlign: 'right', fontSize: 11, color: 'var(--mu)', fontFamily: 'var(--mono)' }}>{idx + 1}</span>
      {t && <span className="badge" style={{ background: t.color + '22', color: t.color, fontSize: 9 }}>{t.name}</span>}
      <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'pointer' }}
        title={item.title} onClick={() => onCard(item)}>{item.title}</span>
      <span title={item.priority} style={{ width: 8, height: 8, borderRadius: '50%', background: PRIO_COLOR[item.priority] || '#64748b', flexShrink: 0 }} />
      {item.story_points > 0 && <span className="badge" style={{ background: 'var(--s3)', color: 'var(--mu2)', fontSize: 9 }}>{item.story_points} SP</span>}
      <span className="badge" style={{ background: 'var(--s3)', color: 'var(--mu2)', fontSize: 9 }}>{colName(item.column_id)}</span>
      {sub ? <Avatar members={members} name={sub.name} size={22} title={sub.name} /> : <span style={{ fontSize: 10, color: 'var(--mu)', width: 22, textAlign: 'center' }}>—</span>}
      {usesSprints && (
        <select value={item.sprint || ''} onChange={(e) => onAssign(item, e.target.value)} style={{ width: 120, flexShrink: 0 }} title="Assign sprint">
          <option value="">— Backlog —</option>
          {iterOptions.map((s) => <option key={s} value={s}>{s}</option>)}
          {item.sprint && !iterOptions.includes(item.sprint) && <option value={item.sprint}>{item.sprint}</option>}
        </select>
      )}
    </div>
  )
}
