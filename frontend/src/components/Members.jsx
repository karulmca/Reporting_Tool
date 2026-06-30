import React, { useState, useMemo } from 'react'
import { useApp } from '../store'
import { Avatar, PodBadge, Empty, Modal, Field } from './ui'
import BulkUpload from './BulkUpload'
import CustomFieldInputs from './CustomFieldInputs'
import { implCount, progCount, podColor } from '../lib/helpers'
import { exportCSV } from '../lib/exports'

const blankAdd = { name: '', id: '', pod: '', sl: '', target: 12, custom: {} }

export default function Members() {
  const { data, isAdmin, run, api, toast } = useApp()
  const { members, ideas, pods } = data
  const cf = data.customFields.member || []
  const [slF, setSlF] = useState('')
  const [podF, setPodF] = useState('')
  const [add, setAdd] = useState(null)
  const [edit, setEdit] = useState(null)

  let rows = members
  if (slF) rows = rows.filter((m) => m.sl === slF)
  if (podF) rows = rows.filter((m) => m.pod === podF)
  rows = rows.slice().sort((a, b) => a.name.localeCompare(b.name))

  // Distinct Service Lines, sourced from PODs and existing members.
  const serviceLines = useMemo(() => {
    const s = new Set()
    pods.forEach((p) => p.sl && s.add(p.sl))
    members.forEach((m) => m.sl && s.add(m.sl))
    return [...s].sort((a, b) => a.localeCompare(b))
  }, [pods, members])
  // Render SL <option>s, keeping a current value that isn't in the master list.
  const slOptions = (current) => {
    const list = [...serviceLines]
    if (current && !list.includes(current)) list.unshift(current)
    return [<option key="" value="">Select</option>].concat(list.map((s) => <option key={s} value={s}>{s}</option>))
  }
  // POD/Team <option>s limited to the chosen Service Line (all PODs if none).
  const podOptionsForSL = (sl) => [<option key="" value="">Select</option>].concat(
    pods.filter((p) => !sl || p.sl === sl).map((p) => <option key={p.code} value={p.code}>{p.name}</option>),
  )

  function openAdd() {
    setAdd({ ...blankAdd, custom: {} })
  }
  async function submitAdd() {
    if (!add.name.trim() || !add.id.trim()) { toast('Name and ID required', 'e'); return }
    if (!add.sl) { toast('Select a Service Line', 'e'); return }
    if (!add.pod) { toast('Select a POD / Team', 'e'); return }
    const ok = await run(() => api.createMember({ id: add.id.trim(), name: add.name.trim(), pod: add.pod, sl: add.sl, target: parseInt(add.target) || 12, custom: add.custom }), 'Member added!')
    if (ok) setAdd(null)
  }
  function openEdit(m) {
    setEdit({ origId: m.id, name: m.name, id: m.id, pod: m.pod, sl: m.sl, target: m.target, custom: { ...(m.custom || {}) } })
  }
  async function submitEdit() {
    const ok = await run(() => api.updateMember(edit.origId, { name: edit.name, pod: edit.pod, sl: edit.sl, target: parseInt(edit.target) || 12, custom: edit.custom }), 'Member updated!')
    if (ok) setEdit(null)
  }
  async function del(id) {
    if (!window.confirm('Remove this member?')) return
    run(() => api.deleteMember(id), 'Removed')
  }

  const podOptions = pods.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)

  return (
    <>
      <div className="tb"><h2>Members</h2>
        <div className="tb-r">
          <select style={{ width: 'auto' }} value={slF} onChange={(e) => { setSlF(e.target.value); setPodF('') }}>
            <option value="">All Service Lines</option>
            {serviceLines.map((sl) => <option key={sl} value={sl}>{sl}</option>)}
          </select>
          <select style={{ width: 'auto' }} value={podF} onChange={(e) => setPodF(e.target.value)}>
            <option value="">All PODs</option>
            {pods.filter((p) => !slF || p.sl === slF).map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
          </select>
          <button className="btn btn-p btn-sm" onClick={openAdd}>+ Add Member</button>
          <BulkUpload kind="member" />
          <button className="btn btn-sm" onClick={() => exportCSV('members', data, { pod: podF, sl: slF })}>&#8659; CSV</button>
        </div>
      </div>
      <div className="con">
        {!rows.length ? <Empty>No members found</Empty> : (
          <div className="tw"><table>
            <thead><tr>
              <th>Member</th><th>Emp ID</th><th>POD</th><th>Service Line</th><th>Target</th><th>Submitted</th><th>Implemented</th><th>In Progress</th><th>Gap</th>
              {cf.map((f) => <th key={f.id}>{f.label}</th>)}
              {isAdmin && <th>Actions</th>}
            </tr></thead>
            <tbody>
              {rows.map((m) => {
                const done = implCount(ideas, m.id)
                const prog = progCount(ideas, m.id)
                const submitted = ideas.filter((i) => i.submitter === m.id).length
                const gap = m.target - done
                const pp = m.target ? Math.min(100, Math.round((done / m.target) * 100)) : 0
                return (
                  <tr key={m.id}>
                    <td><div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <Avatar members={members} name={m.name} />
                      <div><div style={{ fontSize: 12.5, fontWeight: 500 }}>{m.name}</div><div style={{ fontSize: 10, color: 'var(--mu)' }}>{pp}% complete</div></div>
                    </div></td>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{m.id}</td>
                    <td><PodBadge pods={pods} code={m.pod} podColor={podColor} /></td>
                    <td style={{ color: 'var(--mu2)' }}>{m.sl}</td>
                    <td style={{ fontFamily: 'var(--mono)' }}>{m.target}</td>
                    <td><span className="badge bp">{submitted}</span></td>
                    <td><span className="badge bg">{done}</span></td>
                    <td><span className="badge bb">{prog}</span></td>
                    <td><span className={'badge ' + (gap > 6 ? 'br' : gap > 0 ? 'ba' : 'bg')}>{gap}</span></td>
                    {cf.map((f) => <td key={f.id} style={{ color: 'var(--mu2)', fontSize: 12 }}>{(m.custom && m.custom[f.id]) || '-'}</td>)}
                    {isAdmin && <td><div style={{ display: 'flex', gap: 5 }}>
                      <button className="btn btn-sm" onClick={() => openEdit(m)}>Edit</button>
                      <button className="btn btn-sm btn-d" onClick={() => del(m.id)}>X</button>
                    </div></td>}
                  </tr>
                )
              })}
            </tbody>
          </table></div>
        )}
      </div>

      <Modal open={!!add} title="Add Member" onClose={() => setAdd(null)}
        footer={<><button className="btn" onClick={() => setAdd(null)}>Cancel</button><button className="btn btn-p" onClick={submitAdd}>Add Member</button></>}>
        {add && <>
          <div className="fg2">
            <Field label="Full Name"><input value={add.name} placeholder="Surname, Firstname" onChange={(e) => setAdd({ ...add, name: e.target.value })} /></Field>
            <Field label="Employee ID"><input value={add.id} placeholder="e.g. 2012144" onChange={(e) => setAdd({ ...add, id: e.target.value })} /></Field>
          </div>
          <div className="fg2">
            <Field label="Service Line"><select value={add.sl} onChange={(e) => setAdd({ ...add, sl: e.target.value, pod: '' })}>{slOptions(add.sl)}</select></Field>
            <Field label="POD / Team"><select value={add.pod} onChange={(e) => setAdd({ ...add, pod: e.target.value })}>{podOptionsForSL(add.sl)}</select></Field>
          </div>
          <Field label="Annual Target (Ideas)"><input type="number" min="0" value={add.target} onChange={(e) => setAdd({ ...add, target: e.target.value })} /></Field>
          <CustomFieldInputs fields={cf} values={add.custom} onChange={(id, v) => setAdd({ ...add, custom: { ...add.custom, [id]: v } })} />
        </>}
      </Modal>

      <Modal open={!!edit} title="Edit Member" onClose={() => setEdit(null)}
        footer={<><button className="btn" onClick={() => setEdit(null)}>Cancel</button><button className="btn btn-p" onClick={submitEdit}>Save</button></>}>
        {edit && <>
          <div className="fg2">
            <Field label="Full Name"><input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <Field label="Employee ID"><input value={edit.id} readOnly style={{ background: 'var(--s3)', color: 'var(--mu)' }} /></Field>
          </div>
          <div className="fg2">
            <Field label="POD / Team"><select value={edit.pod} onChange={(e) => setEdit({ ...edit, pod: e.target.value })}>{podOptions}</select></Field>
            <Field label="Service Line"><select value={edit.sl} onChange={(e) => setEdit({ ...edit, sl: e.target.value })}>{slOptions(edit.sl)}</select></Field>
          </div>
          <Field label="Annual Target"><input type="number" min="0" value={edit.target} onChange={(e) => setEdit({ ...edit, target: e.target.value })} /></Field>
          <CustomFieldInputs fields={cf} values={edit.custom} onChange={(id, v) => setEdit({ ...edit, custom: { ...edit.custom, [id]: v } })} />
        </>}
      </Modal>
    </>
  )
}
