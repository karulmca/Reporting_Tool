import React, { useState, useEffect, useCallback } from 'react'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useApp } from '../store'
import { Modal, Field, Empty } from './ui'

const SWIMLANES = [['', 'None'], ['assignee', 'Assignee'], ['pod', 'POD / Team'], ['priority', 'Priority'], ['type', 'Work Item Type']]
const ITER_LABELS = ['Sprint', 'Iteration', 'PI']
const FIELD_TYPES = [['text', 'Text'], ['number', 'Number'], ['select', 'Dropdown'], ['textarea', 'Long Text'], ['date', 'Date']]

export default function BoardSettings({ onNav }) {
  const { data, isAdmin, run, api, toast, loadAll } = useApp()
  const board = data.board || { frameworks: [], iterations: {} }
  const frameworks = board.frameworks || []
  const pods = data.pods || []
  const fields = data.customFields.workitem || []

  const [activeFw, setActiveFw] = useState('')
  const [addFw, setAddFw] = useState({ name: '', iteration_label: 'Sprint', uses_sprints: true, sprint_length_weeks: 2 })
  const [editFw, setEditFw] = useState(null)
  const [addCol, setAddCol] = useState({ name: '', wip_limit: 0, is_done: false, color: '#3b82f6' })
  const [editCol, setEditCol] = useState(null)
  const [addType, setAddType] = useState({ name: '', color: '#3b82f6' })
  const [editType, setEditType] = useState(null)
  const [fld, setFld] = useState({ label: '', type: 'text', opts: '', on_card: false })
  const [iterPod, setIterPod] = useState('')
  const [iters, setIters] = useState([])
  const [iterName, setIterName] = useState('')
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  useEffect(() => { if (!activeFw && frameworks.length) setActiveFw(frameworks[0].id) }, [frameworks, activeFw])
  useEffect(() => { if (!iterPod && pods.length) setIterPod(pods[0].code) }, [pods, iterPod])

  const loadIters = useCallback(() => { if (iterPod) api.getIterations(iterPod).then(setIters).catch(() => {}) }, [iterPod]) // eslint-disable-line
  useEffect(() => { loadIters() }, [loadIters])

  if (!isAdmin) {
    return (<><div className="tb"><h2>Board Settings</h2></div><div className="con"><Empty>Switch to Admin mode to configure the board.</Empty></div></>)
  }

  const fw = frameworks.find((f) => f.id === activeFw) || frameworks[0]
  const columns = (fw && fw.columns) || []
  const types = (fw && fw.types) || []

  // --- frameworks ---
  function createFw() {
    if (!addFw.name.trim()) { toast('Framework name required', 'e'); return }
    run(() => api.createFramework({ ...addFw, name: addFw.name.trim(), sprint_length_weeks: parseInt(addFw.sprint_length_weeks) || 2 }), 'Framework added')
      .then((ok) => { if (ok) setAddFw({ name: '', iteration_label: 'Sprint', uses_sprints: true, sprint_length_weeks: 2 }) })
  }
  function saveFw() {
    run(() => api.updateFramework(editFw.id, { name: editFw.name.trim(), iteration_label: editFw.iteration_label, uses_sprints: editFw.uses_sprints, sprint_length_weeks: parseInt(editFw.sprint_length_weeks) || 2 }), 'Framework updated')
      .then((ok) => { if (ok) setEditFw(null) })
  }
  function delFw(f) {
    if (!window.confirm(`Delete framework "${f.name}"? (must be unassigned from PODs)`)) return
    run(() => api.deleteFramework(f.id), 'Framework deleted')
  }
  function setSwim(v) { run(() => api.updateFramework(fw.id, { swimlane: v }), 'Swimlane updated') }

  // --- columns (scoped to active framework) ---
  function createCol() {
    if (!addCol.name.trim()) { toast('Column name required', 'e'); return }
    run(() => api.createColumn({ framework_id: fw.id, name: addCol.name.trim(), wip_limit: parseInt(addCol.wip_limit) || 0, is_done: addCol.is_done, color: addCol.color }), 'Column added')
      .then((ok) => { if (ok) setAddCol({ name: '', wip_limit: 0, is_done: false, color: '#3b82f6' }) })
  }
  function saveCol() {
    run(() => api.updateColumn(editCol.id, { name: editCol.name.trim(), wip_limit: parseInt(editCol.wip_limit) || 0, is_done: editCol.is_done, color: editCol.color }), 'Column updated').then((ok) => { if (ok) setEditCol(null) })
  }
  function delCol(c) { if (window.confirm(`Delete column "${c.name}"?`)) run(() => api.deleteColumn(c.id), 'Column deleted') }
  function moveCol(idx, dir) {
    const ids = columns.map((c) => c.id); const j = idx + dir
    if (j < 0 || j >= ids.length) return
    const t = ids[idx]; ids[idx] = ids[j]; ids[j] = t
    run(() => api.reorderColumns(ids), 'Reordered')
  }

  // --- types ---
  function createType() {
    if (!addType.name.trim()) { toast('Type name required', 'e'); return }
    run(() => api.createWIType({ framework_id: fw.id, name: addType.name.trim(), color: addType.color }), 'Type added')
      .then((ok) => { if (ok) setAddType({ name: '', color: '#3b82f6' }) })
  }
  function saveType() { run(() => api.updateWIType(editType.id, { name: editType.name.trim(), color: editType.color }), 'Type updated').then((ok) => { if (ok) setEditType(null) }) }
  function delType(t) { if (window.confirm(`Delete type "${t.name}"?`)) run(() => api.deleteWIType(t.id), 'Type deleted') }

  // --- POD → framework mapping ---
  function mapPod(code, framework_id) { run(() => api.updatePod(code, { framework_id }), 'POD mapped') }

  // --- iterations ---
  async function addIter() {
    if (!iterName.trim()) { toast('Iteration name required', 'e'); return }
    try { await api.addIteration({ pod: iterPod, name: iterName.trim() }); setIterName(''); loadIters(); loadAll(); toast('Iteration added', 's') }
    catch (e) { toast('Error: ' + e.message, 'e') }
  }
  async function delIter(id) {
    try { await api.deleteIteration(id); loadIters(); loadAll(); toast('Removed', 's') } catch (e) { toast('Error: ' + e.message, 'e') }
  }

  // --- card fields ---
  function onFieldDragEnd(e) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const ids = fields.map((f) => f.id); const from = ids.indexOf(active.id); const to = ids.indexOf(over.id)
    if (from < 0 || to < 0) return
    run(() => api.reorderFields(arrayMove(ids, from, to)), 'Fields reordered')
  }
  function addField() {
    if (!fld.label.trim()) { toast('Field label required', 'e'); return }
    const options = fld.type === 'select' ? fld.opts.split(',').map((x) => x.trim()).filter(Boolean) : []
    if (fld.type === 'select' && !options.length) { toast('Add at least one option', 'e'); return }
    run(() => api.createField({ entity: 'workitem', label: fld.label.trim(), type: fld.type, options, on_card: fld.on_card }), 'Field added')
      .then((ok) => { if (ok) setFld({ label: '', type: 'text', opts: '', on_card: false }) })
  }
  function toggleOnCard(f) { run(() => api.updateField(f.id, { on_card: !f.on_card }), 'Updated') }
  function delField(id) { run(() => api.deleteField(id), 'Field removed') }

  const podFw = (code) => { const p = pods.find((x) => x.code === code); return p ? p.framework_id : '' }

  return (
    <>
      <div className="tb"><h2>Board Settings</h2>
        <div className="tb-r"><button className="btn btn-sm" onClick={() => onNav('scrum-board')}>&#8592; Back to board</button></div>
      </div>
      <div className="con">
        {/* Frameworks + active framework cadence */}
        <div className="g2">
          <div>
            <div className="sh">Scaling Frameworks</div>
            <div className="card">
              {frameworks.map((f) => (
                <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--b1)', background: f.id === activeFw ? 'var(--s2)' : 'transparent', cursor: 'pointer' }} onClick={() => setActiveFw(f.id)}>
                  <span style={{ flex: 1, fontWeight: f.id === activeFw ? 700 : 500, fontSize: 12.5 }}>{f.name}</span>
                  <span className="badge bb" style={{ fontSize: 9 }}>{f.uses_sprints ? `${f.iteration_label} · ${f.sprint_length_weeks}w` : 'Continuous'}</span>
                  <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); setEditFw({ ...f }) }}>Edit</button>
                  <button className="btn btn-sm btn-d" onClick={(e) => { e.stopPropagation(); delFw(f) }}>X</button>
                </div>
              ))}
              <div className="dv" />
              <div className="fg3">
                <div><label className="fl">New framework</label><input value={addFw.name} placeholder="e.g. SAFe Portfolio" onChange={(e) => setAddFw({ ...addFw, name: e.target.value })} /></div>
                <div><label className="fl">Iteration label</label><select value={addFw.iteration_label} onChange={(e) => setAddFw({ ...addFw, iteration_label: e.target.value })}>{ITER_LABELS.map((l) => <option key={l}>{l}</option>)}</select></div>
                <div><label className="fl">Length (wks)</label><input type="number" min="1" value={addFw.sprint_length_weeks} onChange={(e) => setAddFw({ ...addFw, sprint_length_weeks: e.target.value })} /></div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                <label style={{ fontSize: 12, color: 'var(--mu2)', display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={addFw.uses_sprints} onChange={(e) => setAddFw({ ...addFw, uses_sprints: e.target.checked })} /> Uses sprints (uncheck for Kanban/flow)</label>
                <button className="btn btn-p btn-sm" style={{ marginLeft: 'auto' }} onClick={createFw}>+ Add Framework</button>
              </div>
            </div>
          </div>

          <div>
            <div className="sh">{fw ? `Swimlanes — ${fw.name}` : 'Swimlanes'}</div>
            <div className="card">
              {fw ? <>
                <Field label="Group rows by"><select value={fw.swimlane || ''} onChange={(e) => setSwim(e.target.value)}>{SWIMLANES.map(([v, n]) => <option key={v} value={v}>{n}</option>)}</select></Field>
                <div style={{ fontSize: 11, color: 'var(--mu)' }}>Cadence: {fw.uses_sprints ? `${fw.iteration_label}, ${fw.sprint_length_weeks} week(s)` : 'Continuous flow (no sprints)'}. Dragging a card to another lane updates its {fw.swimlane || 'group'}.</div>
              </> : <Empty>Add a framework first.</Empty>}
            </div>
          </div>
        </div>

        {/* Framework picker for the workflow sections below */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 18, paddingBottom: 6, borderBottom: '1px solid var(--b1)' }}>
          <span className="sh" style={{ marginBottom: 0 }}>Configure workflow for</span>
          <select value={fw ? fw.id : ''} onChange={(e) => setActiveFw(e.target.value)} style={{ width: 'auto', fontWeight: 600 }}>
            {frameworks.map((f) => <option key={f.id} value={f.id}>{f.name}{f.uses_sprints ? '' : ' (Kanban/flow)'}</option>)}
          </select>
          <span style={{ fontSize: 11, color: 'var(--mu)' }}>Columns, types & swimlane below apply to this framework.</span>
        </div>

        {/* Columns + Types for active framework */}
        <div className="g2" style={{ marginTop: 12 }}>
          <div>
            <div className="sh">Columns / States {fw && <span style={{ color: 'var(--mu)', fontWeight: 400 }}>· {fw.name}</span>}</div>
            <div className="card">
              {columns.map((c, idx) => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--b1)' }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: c.color }} />
                  <span style={{ flex: 1, fontWeight: 500, fontSize: 12.5 }}>{c.name}</span>
                  {c.wip_limit > 0 && <span className="badge ba" style={{ fontSize: 9 }}>WIP {c.wip_limit}</span>}
                  {c.is_done && <span className="badge bg" style={{ fontSize: 9 }}>done</span>}
                  <button className="btn btn-sm" disabled={idx === 0} onClick={() => moveCol(idx, -1)}>↑</button>
                  <button className="btn btn-sm" disabled={idx === columns.length - 1} onClick={() => moveCol(idx, 1)}>↓</button>
                  <button className="btn btn-sm" onClick={() => setEditCol({ ...c })}>Edit</button>
                  <button className="btn btn-sm btn-d" onClick={() => delCol(c)}>X</button>
                </div>
              ))}
              <div className="dv" />
              <div className="fg3">
                <div><label className="fl">New column</label><input value={addCol.name} placeholder="e.g. In Review" onChange={(e) => setAddCol({ ...addCol, name: e.target.value })} /></div>
                <div><label className="fl">WIP limit</label><input type="number" min="0" value={addCol.wip_limit} onChange={(e) => setAddCol({ ...addCol, wip_limit: e.target.value })} /></div>
                <div><label className="fl">Color</label><input type="color" value={addCol.color} onChange={(e) => setAddCol({ ...addCol, color: e.target.value })} style={{ width: '100%', height: 32, padding: 2 }} /></div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                <label style={{ fontSize: 12, color: 'var(--mu2)', display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={addCol.is_done} onChange={(e) => setAddCol({ ...addCol, is_done: e.target.checked })} /> Counts as Done</label>
                <button className="btn btn-p btn-sm" style={{ marginLeft: 'auto' }} onClick={createCol} disabled={!fw}>+ Add Column</button>
              </div>
            </div>
          </div>

          <div>
            <div className="sh">Work Item Types {fw && <span style={{ color: 'var(--mu)', fontWeight: 400 }}>· {fw.name}</span>}</div>
            <div className="card">
              {types.map((t) => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--b1)' }}>
                  <span className="badge" style={{ background: t.color + '22', color: t.color }}>{t.name}</span>
                  <span style={{ flex: 1 }} />
                  <button className="btn btn-sm" onClick={() => setEditType({ ...t })}>Edit</button>
                  <button className="btn btn-sm btn-d" onClick={() => delType(t)}>X</button>
                </div>
              ))}
              <div className="dv" />
              <div className="fg2">
                <div><label className="fl">New type</label><input value={addType.name} placeholder="e.g. Epic" onChange={(e) => setAddType({ ...addType, name: e.target.value })} /></div>
                <div><label className="fl">Color</label><input type="color" value={addType.color} onChange={(e) => setAddType({ ...addType, color: e.target.value })} style={{ width: '100%', height: 32, padding: 2 }} /></div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}><button className="btn btn-p btn-sm" onClick={createType} disabled={!fw}>+ Add Type</button></div>
            </div>
          </div>
        </div>

        {/* POD mapping + iterations */}
        <div className="g2" style={{ marginTop: 16 }}>
          <div>
            <div className="sh">PODs → Framework</div>
            <div className="card">
              {pods.length ? pods.map((p) => (
                <div key={p.code} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--b1)' }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: p.color }} />
                  <span style={{ flex: 1, fontSize: 12.5, fontWeight: 500 }}>{p.code} <span style={{ color: 'var(--mu)', fontWeight: 400 }}>{p.name}</span></span>
                  <select value={podFw(p.code)} onChange={(e) => mapPod(p.code, e.target.value)} style={{ width: 'auto' }}>
                    {frameworks.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </div>
              )) : <Empty>No PODs defined.</Empty>}
            </div>
          </div>

          <div>
            <div className="sh">Iterations per POD</div>
            <div className="card">
              <Field label="POD"><select value={iterPod} onChange={(e) => setIterPod(e.target.value)}>{pods.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}</select></Field>
              <div style={{ maxHeight: 160, overflowY: 'auto', marginBottom: 8 }}>
                {iters.length ? iters.map((it) => (
                  <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--b1)' }}>
                    <span style={{ flex: 1, fontSize: 12.5 }}>{it.name}</span>
                    <button className="btn btn-sm btn-d" onClick={() => delIter(it.id)}>X</button>
                  </div>
                )) : <div style={{ fontSize: 12, color: 'var(--mu)', padding: '4px 0' }}>No iterations defined for this POD yet. (Existing item sprints still show on the board.)</div>}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={iterName} placeholder="e.g. Sprint 8 / PI2-Iter1" onChange={(e) => setIterName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addIter() }} />
                <button className="btn btn-p btn-sm" onClick={addIter}>+ Add</button>
              </div>
            </div>
          </div>
        </div>

        {/* Card fields (shared across frameworks) */}
        <div className="g2" style={{ marginTop: 16 }}>
          <div>
            <div className="sh">Card Fields <span style={{ color: 'var(--mu)', fontWeight: 400 }}>· shared</span></div>
            <div className="card">
              {fields.length ? (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onFieldDragEnd}>
                  <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
                    {fields.map((f) => <SortableFieldRow key={f.id} f={f} onToggle={() => toggleOnCard(f)} onDelete={() => delField(f.id)} />)}
                  </SortableContext>
                </DndContext>
              ) : <div style={{ color: 'var(--mu)', fontSize: 12, padding: '6px 0' }}>No card fields yet.</div>}
              {fields.length > 1 && <div style={{ fontSize: 10, color: 'var(--mu)', marginTop: 4 }}>Drag the handle to reorder how fields appear on cards & forms.</div>}
              <div className="dv" />
              <div className="fg2">
                <div><label className="fl">Label</label><input value={fld.label} placeholder="e.g. Work Effort" onChange={(e) => setFld({ ...fld, label: e.target.value })} /></div>
                <div><label className="fl">Type</label><select value={fld.type} onChange={(e) => setFld({ ...fld, type: e.target.value })}>{FIELD_TYPES.map(([v, n]) => <option key={v} value={v}>{n}</option>)}</select></div>
              </div>
              {fld.type === 'select' && <div style={{ marginTop: 8 }}><label className="fl">Options (comma sep.)</label><input value={fld.opts} placeholder="Low, Medium, High" onChange={(e) => setFld({ ...fld, opts: e.target.value })} /></div>}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                <label style={{ fontSize: 12, color: 'var(--mu2)', display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={fld.on_card} onChange={(e) => setFld({ ...fld, on_card: e.target.checked })} /> Show on card face</label>
                <button className="btn btn-p btn-sm" style={{ marginLeft: 'auto' }} onClick={addField}>+ Add Field</button>
              </div>
            </div>
          </div>
          <div />
        </div>
      </div>

      {/* Edit framework modal */}
      <Modal open={!!editFw} title="Edit Framework" onClose={() => setEditFw(null)}
        footer={<><button className="btn" onClick={() => setEditFw(null)}>Cancel</button><button className="btn btn-p" onClick={saveFw}>Save</button></>}>
        {editFw && <>
          <Field label="Name"><input value={editFw.name} onChange={(e) => setEditFw({ ...editFw, name: e.target.value })} /></Field>
          <div className="fg2">
            <Field label="Iteration label"><select value={editFw.iteration_label} onChange={(e) => setEditFw({ ...editFw, iteration_label: e.target.value })}>{ITER_LABELS.map((l) => <option key={l}>{l}</option>)}</select></Field>
            <Field label="Sprint length (weeks)"><input type="number" min="1" value={editFw.sprint_length_weeks} onChange={(e) => setEditFw({ ...editFw, sprint_length_weeks: e.target.value })} /></Field>
          </div>
          <label style={{ fontSize: 12, color: 'var(--mu2)', display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={editFw.uses_sprints} onChange={(e) => setEditFw({ ...editFw, uses_sprints: e.target.checked })} /> Uses sprints (uncheck for Kanban/flow)</label>
        </>}
      </Modal>

      {/* Edit column modal */}
      <Modal open={!!editCol} title="Edit Column" onClose={() => setEditCol(null)}
        footer={<><button className="btn" onClick={() => setEditCol(null)}>Cancel</button><button className="btn btn-p" onClick={saveCol}>Save</button></>}>
        {editCol && <>
          <Field label="Name"><input value={editCol.name} onChange={(e) => setEditCol({ ...editCol, name: e.target.value })} /></Field>
          <div className="fg2">
            <Field label="WIP limit (0 = none)"><input type="number" min="0" value={editCol.wip_limit} onChange={(e) => setEditCol({ ...editCol, wip_limit: e.target.value })} /></Field>
            <Field label="Color"><input type="color" value={editCol.color} onChange={(e) => setEditCol({ ...editCol, color: e.target.value })} style={{ width: '100%', height: 34, padding: 2 }} /></Field>
          </div>
          <label style={{ fontSize: 12, color: 'var(--mu2)', display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={editCol.is_done} onChange={(e) => setEditCol({ ...editCol, is_done: e.target.checked })} /> Counts as Done</label>
        </>}
      </Modal>

      {/* Edit type modal */}
      <Modal open={!!editType} title="Edit Work Item Type" onClose={() => setEditType(null)}
        footer={<><button className="btn" onClick={() => setEditType(null)}>Cancel</button><button className="btn btn-p" onClick={saveType}>Save</button></>}>
        {editType && <>
          <Field label="Name"><input value={editType.name} onChange={(e) => setEditType({ ...editType, name: e.target.value })} /></Field>
          <Field label="Color"><input type="color" value={editType.color} onChange={(e) => setEditType({ ...editType, color: e.target.value })} style={{ width: '100%', height: 34, padding: 2 }} /></Field>
        </>}
      </Modal>
    </>
  )
}

function SortableFieldRow({ f, onToggle, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: f.id })
  const style = { transform: CSS.Transform.toString(transform), transition, background: isDragging ? 'var(--s3)' : 'transparent' }
  return (
    <div ref={setNodeRef} style={{ ...style, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--b1)' }}>
      <span {...attributes} {...listeners} title="Drag to reorder" style={{ cursor: 'grab', color: 'var(--mu)', fontSize: 14, lineHeight: 1, userSelect: 'none' }}>⠿</span>
      <span style={{ flex: 1, fontSize: 12.5, fontWeight: 500 }}>{f.label}</span>
      <span className="badge bb">{f.type}</span>
      <label style={{ fontSize: 10, color: 'var(--mu2)', display: 'flex', gap: 4, alignItems: 'center' }}><input type="checkbox" checked={!!f.on_card} onChange={onToggle} /> on card</label>
      <button className="btn btn-sm btn-d" onClick={onDelete}>X</button>
    </div>
  )
}
