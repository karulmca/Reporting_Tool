import React, { useState, useMemo } from 'react'
import { useApp } from '../store'
import { Avatar, PodBadge, Empty, Modal, Field } from './ui'
import { podColor } from '../lib/helpers'
import { exportCSV } from '../lib/exports'

// ---- Manage Courses (rename / delete) -------------------------------------
function CourseRow({ course }) {
  const { run, api, toast } = useApp()
  const [name, setName] = useState(course.name)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--b1)' }}>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--mu2)', minWidth: 110 }}>{course.id}</span>
      <input value={name} onChange={(e) => setName(e.target.value)} />
      <button className="btn btn-sm btn-p" onClick={() => run(() => api.updateCourse(course.id, { name }), 'Course updated')}>Save</button>
      <button className="btn btn-sm btn-d" onClick={() => { if (window.confirm(`Delete course ${course.id}? Member statuses for it will be removed.`)) run(() => api.deleteCourse(course.id), 'Course deleted') }}>Delete</button>
    </div>
  )
}

function ManageCourses({ onClose }) {
  const { data } = useApp()
  const courses = data.training.courses || []
  return (
    <Modal open title="Manage Courses" width="560px" onClose={onClose}
      footer={<button className="btn btn-p" onClick={onClose}>Done</button>}>
      {courses.length ? courses.map((c) => <CourseRow key={c.id} course={c} />)
        : <div style={{ color: 'var(--mu)', fontSize: 12 }}>No courses yet. Use “+ Add Course”.</div>}
    </Modal>
  )
}

// ---- Manage Statuses (configurable values + colours) ----------------------
function StatusRow({ opt }) {
  const { run, api } = useApp()
  const [label, setLabel] = useState(opt.label)
  const [color, setColor] = useState(opt.color)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--b1)' }}>
      <input type="color" value={color} onChange={(e) => setColor(e.target.value)} style={{ width: 38, padding: 2, height: 32 }} />
      <input value={label} onChange={(e) => setLabel(e.target.value)} />
      <span className="badge" style={{ background: color + '22', color }}>{label || '—'}</span>
      <button className="btn btn-sm btn-p" onClick={() => run(() => api.updateStatusOption(opt.id, { label, color }), 'Status updated')}>Save</button>
      <button className="btn btn-sm btn-d" onClick={() => { if (window.confirm(`Delete status “${opt.label}”?`)) run(() => api.deleteStatusOption(opt.id), 'Status removed') }}>X</button>
    </div>
  )
}

function ManageStatuses({ onClose }) {
  const { data, run, api, toast } = useApp()
  const opts = data.training.statusOptions || []
  const [label, setLabel] = useState('')
  const [color, setColor] = useState('#3b82f6')
  async function add() {
    if (!label.trim()) { toast('Status label required', 'e'); return }
    const ok = await run(() => api.addStatusOption({ label: label.trim(), color }), 'Status added')
    if (ok) { setLabel(''); setColor('#3b82f6') }
  }
  return (
    <Modal open title="Manage Status Options" width="560px" onClose={onClose}
      footer={<button className="btn btn-p" onClick={onClose}>Done</button>}>
      {opts.length ? opts.map((o) => <StatusRow key={o.id} opt={o} />)
        : <div style={{ color: 'var(--mu)', fontSize: 12 }}>No status options.</div>}
      <div className="dv" />
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
        <div style={{ width: 50 }}><label className="fl">Color</label><input type="color" value={color} onChange={(e) => setColor(e.target.value)} style={{ padding: 2, height: 34 }} /></div>
        <div style={{ flex: 1 }}><label className="fl">New status</label><input value={label} placeholder="e.g. Enrolled" onChange={(e) => setLabel(e.target.value)} /></div>
        <button className="btn btn-p btn-sm" onClick={add}>+ Add</button>
      </div>
    </Modal>
  )
}

// ---- Training matrix -------------------------------------------------------
export default function Training() {
  const { data, isAdmin, run, api, toast } = useApp()
  const { members } = data
  const courses = data.training.courses || []
  const status = data.training.status || {}
  const statusOptions = data.training.statusOptions || []
  const colorMap = Object.fromEntries(statusOptions.map((o) => [o.label, o.color]))
  const optionLabels = statusOptions.map((o) => o.label)
  const [slF, setSlF] = useState('')
  const [podF, setPodF] = useState('')
  const [add, setAdd] = useState(null)
  const [manageCourses, setManageCourses] = useState(false)
  const [manageStatuses, setManageStatuses] = useState(false)

  // Distinct Service Lines, sourced from PODs and existing members.
  const serviceLines = useMemo(() => {
    const s = new Set()
    data.pods.forEach((p) => p.sl && s.add(p.sl))
    members.forEach((m) => m.sl && s.add(m.sl))
    return [...s].sort((a, b) => a.localeCompare(b))
  }, [data.pods, members])

  let rows = members
  if (slF) rows = rows.filter((m) => m.sl === slF)
  if (podF) rows = rows.filter((m) => m.pod === podF)
  rows = rows.slice().sort((a, b) => a.name.localeCompare(b.name))

  function update(mid, cid, val) {
    run(() => api.setTrainingStatus({ memberId: mid, courseId: cid, status: val }))
  }
  async function submitAdd() {
    if (!add.id.trim()) { toast('Course ID required', 'e'); return }
    const ok = await run(() => api.addCourse({ id: add.id.trim(), name: add.name.trim() || add.id.trim() }), 'Course added!')
    if (ok) setAdd(null)
  }

  return (
    <>
      <div className="tb"><h2>Training Status</h2>
        <div className="tb-r">
          <select style={{ width: 'auto' }} value={slF} onChange={(e) => { setSlF(e.target.value); setPodF('') }}>
            <option value="">All Service Lines</option>
            {serviceLines.map((sl) => <option key={sl} value={sl}>{sl}</option>)}
          </select>
          <select style={{ width: 'auto' }} value={podF} onChange={(e) => setPodF(e.target.value)}>
            <option value="">All PODs</option>
            {data.pods.filter((p) => !slF || p.sl === slF).map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
          </select>
          {isAdmin && <>
            <button className="btn btn-p btn-sm" onClick={() => setAdd({ id: '', name: '' })}>+ Add Course</button>
            <button className="btn btn-sm" onClick={() => setManageCourses(true)}>&#9881; Courses</button>
            <button className="btn btn-sm" onClick={() => setManageStatuses(true)}>&#9881; Statuses</button>
          </>}
          <button className="btn btn-sm" onClick={() => exportCSV('training', data)}>&#8659; CSV</button>
        </div>
      </div>
      <div className="con">
        {!courses.length ? <Empty>No courses yet. Click + Add Course to begin.</Empty>
          : !rows.length ? <Empty>No members found for this filter.</Empty> : (
            <div className="tw"><table>
              <thead><tr>
                <th>Member</th><th>Emp ID</th><th>POD</th>
                {courses.map((c) => (
                  <th key={c.id} style={{ background: 'rgba(59,130,246,.08)', color: 'var(--blue)', textAlign: 'center' }}>
                    {c.id}<br /><span style={{ fontSize: 9, fontWeight: 400, color: 'var(--mu)' }}>{c.name}</span>
                  </th>
                ))}
              </tr></thead>
              <tbody>
                {rows.map((m) => (
                  <tr key={m.id}>
                    <td><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Avatar members={members} name={m.name} size={26} />{m.name}</div></td>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{m.id}</td>
                    <td><PodBadge pods={data.pods} code={m.pod} podColor={podColor} /></td>
                    {courses.map((c) => {
                      const st = (status[m.id] || {})[c.id] || ''
                      const col = colorMap[st]
                      // Keep a renamed/removed value visible until it's changed.
                      const extra = st && !optionLabels.includes(st) ? [st] : []
                      return (
                        <td key={c.id} style={{ textAlign: 'center' }}>
                          <select
                            style={{ width: 'auto', padding: '3px 8px', fontSize: 11, borderColor: col ? col + '55' : undefined, color: col || undefined }}
                            value={st} disabled={!isAdmin}
                            onChange={(e) => update(m.id, c.id, e.target.value)}>
                            <option value="">-</option>
                            {extra.map((o) => <option key={o} value={o}>{o}</option>)}
                            {statusOptions.map((o) => <option key={o.id} value={o.label}>{o.label}</option>)}
                          </select>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}
      </div>

      <Modal open={!!add} title="Add Training Course" onClose={() => setAdd(null)}
        footer={<><button className="btn" onClick={() => setAdd(null)}>Cancel</button><button className="btn btn-p" onClick={submitAdd}>Add Course</button></>}>
        {add && <div className="fg2">
          <Field label="Course ID"><input value={add.id} placeholder="e.g. ELRNG01555" onChange={(e) => setAdd({ ...add, id: e.target.value })} /></Field>
          <Field label="Course Name"><input value={add.name} placeholder="Course title" onChange={(e) => setAdd({ ...add, name: e.target.value })} /></Field>
        </div>}
      </Modal>

      {manageCourses && <ManageCourses onClose={() => setManageCourses(false)} />}
      {manageStatuses && <ManageStatuses onClose={() => setManageStatuses(false)} />}
    </>
  )
}
