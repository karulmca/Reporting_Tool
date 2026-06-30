import React, { useState } from 'react'
import { useApp } from '../store'
import { Avatar, Empty, Modal, Field } from './ui'
import { implCount, progCount, PAL } from '../lib/helpers'

const COLORS = [
  ['#3b82f6', 'Blue'], ['#22c55e', 'Green'], ['#f59e0b', 'Amber'], ['#ef4444', 'Red'],
  ['#8b5cf6', 'Purple'], ['#14b8a6', 'Teal'], ['#f97316', 'Orange'], ['#ec4899', 'Pink'],
]
const colorOptions = COLORS.map(([v, n]) => <option key={v} value={v}>{n}</option>)

export default function Pods() {
  const { data, isAdmin, run, api, toast } = useApp()
  const { pods, members, ideas } = data
  const [add, setAdd] = useState(null)
  const [edit, setEdit] = useState(null)

  const sorted = pods.slice().sort((a, b) => a.code.localeCompare(b.code))
  // Group PODs by Service Line for display.
  const groups = []
  sorted.forEach((p) => {
    const sl = p.sl || 'Unassigned'
    let g = groups.find((x) => x.sl === sl)
    if (!g) { g = { sl, pods: [] }; groups.push(g) }
    g.pods.push(p)
  })
  groups.sort((a, b) => a.sl.localeCompare(b.sl))

  async function submitAdd() {
    const code = add.code.trim().toUpperCase()
    if (!code) { toast('POD code required', 'e'); return }
    const ok = await run(() => api.createPod({ code, name: add.name.trim() || code, sl: add.sl, color: add.color }), 'POD added!')
    if (ok) setAdd(null)
  }
  async function submitEdit() {
    const ok = await run(() => api.updatePod(edit.code, { name: edit.name, sl: edit.sl, color: edit.color }), 'POD updated!')
    if (ok) setEdit(null)
  }
  async function del(code) {
    if (members.some((m) => m.pod === code)) { toast('Cannot remove: POD has members', 'e'); return }
    if (!window.confirm('Remove POD ' + code + '?')) return
    run(() => api.deletePod(code), 'POD removed')
  }

  return (
    <>
      <div className="tb"><h2>PODs / Teams</h2><div className="tb-r"><button className="btn btn-p btn-sm" onClick={() => setAdd({ code: '', name: '', sl: 'M&E', color: '#3b82f6' })}>+ Add POD</button></div></div>
      <div className="con">
        {!pods.length ? <Empty>No PODs yet. Add one above.</Empty> : (
          <div>
            {groups.map((grp) => {
              const slCol = grp.pods.find((p) => p.color)?.color || PAL[0]
              const slMems = grp.pods.reduce((a, p) => a + members.filter((m) => m.pod === p.code).length, 0)
              const slImpl = grp.pods.reduce((a, p) => a + members.filter((m) => m.pod === p.code).reduce((s, m) => s + implCount(ideas, m.id), 0), 0)
              return (
              <div className="pod-sec" key={grp.sl} style={{ '--slc': slCol }}>
                <div className="pod-sec-h">
                  <span className="dot" />
                  <h3>{grp.sl}</h3>
                  <span className="spacer" />
                  <span className="chip">{grp.pods.length} team{grp.pods.length !== 1 ? 's' : ''}</span>
                  <span className="chip">{slMems} members</span>
                  <span className="chip">{slImpl} implemented</span>
                </div>
                <div className="pod-grid">
            {grp.pods.map((p, i) => {
              const mems = members.filter((m) => m.pod === p.code)
              const impl = mems.reduce((a, m) => a + implCount(ideas, m.id), 0)
              const inPr = mems.reduce((a, m) => a + progCount(ideas, m.id), 0)
              const target = mems.reduce((a, m) => a + m.target, 0)
              const pct = target ? Math.min(100, Math.round((impl / target) * 100)) : 0
              const col = p.color || PAL[i % PAL.length]
              const pctCol = pct >= 80 ? 'var(--green)' : pct >= 50 ? 'var(--amber)' : 'var(--red)'
              return (
                <div className="card pod-card" key={p.code} style={{ '--pc': col }}>
                  <div className="hd">
                    <span className="code">{p.code}</span>
                    {p.name && p.name !== p.code && <span className="nm">{p.name}</span>}
                    {isAdmin && <div style={{ display: 'flex', gap: 5, marginLeft: 'auto' }}>
                      <button className="btn btn-sm" onClick={() => setEdit({ code: p.code, name: p.name, sl: p.sl, color: p.color || '#3b82f6' })}>Edit</button>
                      <button className="btn btn-sm btn-d" onClick={() => del(p.code)}>X</button>
                    </div>}
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--mu)', marginBottom: 14 }}>Service Line: {p.sl}</div>
                  <div className="g3" style={{ gap: 8, marginBottom: 14 }}>
                    <div className="pod-stat"><div className="l">Members</div><div className="v" style={{ color: col }}>{mems.length}</div></div>
                    <div className="pod-stat"><div className="l">Implemented</div><div className="v" style={{ color: 'var(--green)' }}>{impl}</div></div>
                    <div className="pod-stat"><div className="l">In Progress</div><div className="v" style={{ color: 'var(--blue)' }}>{inPr}</div></div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 5 }}>
                    <span style={{ color: 'var(--mu)' }}>Progress: {impl} / {target} ideas</span>
                    <span style={{ fontWeight: 600, color: pctCol }}>{pct}%</span>
                  </div>
                  <div className="pbar" style={{ height: 8, marginBottom: 14 }}><div className="pbar-f" style={{ width: pct + '%', background: col }} /></div>
                  <div style={{ fontSize: 10, color: 'var(--mu)', marginBottom: 7, textTransform: 'uppercase', letterSpacing: '.06em' }}>Team</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {mems.map((m) => {
                      const d = implCount(ideas, m.id)
                      const pp = m.target ? Math.min(100, Math.round((d / m.target) * 100)) : 0
                      return <Avatar key={m.id} members={members} name={m.name} title={`${m.name}: ${d}/${m.target}`} style={{ border: '2px solid ' + (pp >= 100 ? 'var(--green)' : pp > 0 ? 'var(--amber)' : 'transparent') }} />
                    })}
                    {mems.length === 0 && <div style={{ fontSize: 12, color: 'var(--mu)', fontStyle: 'italic' }}>No members yet</div>}
                  </div>
                </div>
              )
            })}
                </div>
              </div>
              )
            })}
          </div>
        )}
      </div>

      <Modal open={!!add} title="Add POD / Team" onClose={() => setAdd(null)}
        footer={<><button className="btn" onClick={() => setAdd(null)}>Cancel</button><button className="btn btn-p" onClick={submitAdd}>Add POD</button></>}>
        {add && <>
          <div className="fg2">
            <Field label="POD Code"><input value={add.code} placeholder="e.g. FE, BE, QA" onChange={(e) => setAdd({ ...add, code: e.target.value })} /></Field>
            <Field label="POD Name"><input value={add.name} placeholder="Full team name" onChange={(e) => setAdd({ ...add, name: e.target.value })} /></Field>
          </div>
          <div className="fg2">
            <Field label="Service Line"><input value={add.sl} onChange={(e) => setAdd({ ...add, sl: e.target.value })} /></Field>
            <Field label="Color"><select value={add.color} onChange={(e) => setAdd({ ...add, color: e.target.value })}>{colorOptions}</select></Field>
          </div>
        </>}
      </Modal>

      <Modal open={!!edit} title="Edit POD / Team" onClose={() => setEdit(null)}
        footer={<><button className="btn" onClick={() => setEdit(null)}>Cancel</button><button className="btn btn-p" onClick={submitEdit}>Save Changes</button></>}>
        {edit && <>
          <Field label="POD Code (read-only)"><input value={edit.code} readOnly style={{ background: 'var(--s3)', color: 'var(--mu)' }} /></Field>
          <Field label="POD Name"><input value={edit.name} placeholder="Full team name" onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
          <div className="fg2">
            <Field label="Service Line"><input value={edit.sl} onChange={(e) => setEdit({ ...edit, sl: e.target.value })} /></Field>
            <Field label="Color"><select value={edit.color} onChange={(e) => setEdit({ ...edit, color: e.target.value })}>{colorOptions}</select></Field>
          </div>
        </>}
      </Modal>
    </>
  )
}
