import React, { useState, useMemo } from 'react'
import { useApp } from '../store'
import { Avatar, StatusBadge, PodBadge, Empty, Modal, Field } from './ui'
import BulkUpload from './BulkUpload'
import CustomFieldInputs from './CustomFieldInputs'
import { memberByID, STATUSES, MONTHS, podColor, SAVINGS_TYPES, fmtUSD } from '../lib/helpers'
import { exportCSV } from '../lib/exports'

// Raw "Stage of the Idea" values seen in the Idea Wall export (free-text; the
// backend maps these onto the app status set for dashboards).
const STAGES = ['Approved for implementation', 'Implementation in progress', 'Implemented', 'On-Hold', 'Rejected']

// Sentinel filter value for ideas whose submitter isn't a current member
// (so they map to no Service Line / POD).
const UNMAPPED = '__UNMAPPED__'

// Resolve a submitter from the latest Members data: prefer a known member
// (giving its live POD + Service Line), then fall back to the name captured on
// the idea, then the bare employee id.
function submitterLabel(members, idea) {
  const m = memberByID(members, idea.submitter)
  return {
    member: m,
    name: m ? m.name : (idea.submitter_name || idea.submitter || '—'),
    pod: m ? m.pod : '',
    sl: m ? m.sl : '',
  }
}

export default function Ideas() {
  const { data, isAdmin, run, api, toast } = useApp()
  const { members, ideas } = data
  const cf = data.customFields.idea || []
  const [stF, setStF] = useState('')
  const [slF, setSlF] = useState('')
  const [podF, setPodF] = useState('')
  const [q, setQ] = useState('')
  const [add, setAdd] = useState(null)
  const [edit, setEdit] = useState(null)
  const [view, setView] = useState(null)

  // Employee ids that are current members — anything else is "Unmapped".
  const memberIds = useMemo(() => new Set(members.map((m) => m.id)), [members])
  // Distinct Service Lines drawn from the latest Members data, for the filter.
  const serviceLines = useMemo(
    () => [...new Set(members.map((m) => m.sl).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [members],
  )

  const rows = useMemo(() => {
    let r = ideas.slice()
    if (stF) r = r.filter((i) => i.status === stF)
    if (slF === UNMAPPED) {
      r = r.filter((i) => !memberIds.has(i.submitter))
    } else if (slF) {
      const mids = new Set(members.filter((m) => m.sl === slF).map((m) => m.id))
      r = r.filter((i) => mids.has(i.submitter))
    }
    if (podF) {
      const pmids = new Set(members.filter((m) => m.pod === podF).map((m) => m.id))
      r = r.filter((i) => pmids.has(i.submitter))
    }
    if (q.trim()) {
      const needle = q.trim().toLowerCase()
      r = r.filter((i) => [i.idea_id, i.title, i.submitter, i.submitter_name, i.project_name, i.tags]
        .some((v) => String(v || '').toLowerCase().includes(needle)))
    }
    return r.sort((a, b) => submitterLabel(members, a).name.localeCompare(submitterLabel(members, b).name)
      || (a.title || '').localeCompare(b.title || ''))
  }, [ideas, members, stF, slF, podF, q, memberIds])

  const unmappedCount = useMemo(() => ideas.filter((i) => !memberIds.has(i.submitter)).length, [ideas, memberIds])

  function openAdd() {
    setAdd({ idea_id: '', pod: '', problem: '', title: '', desc: '', solution: '', benefit: '',
      submitter: members[0] ? members[0].id : '', status: 'Proposed', stage: '',
      savings_type: '', savings_amount: '',
      workflow: '', competency: '', tags: '', project_name: '', sprint: '', contributors: '', comments: '', custom: {} })
  }
  function setAddPod(pod) {
    const pool = members.filter((m) => !pod || m.pod === pod)
    setAdd({ ...add, pod, submitter: pool[0] ? pool[0].id : '' })
  }
  async function submitAdd() {
    if (!add.idea_id.trim()) { toast('Idea ID is required', 'e'); return }
    if (!add.title.trim()) { toast('Title required', 'e'); return }
    const sub = memberByID(members, add.submitter)
    const ok = await run(() => api.createIdea({
      idea_id: add.idea_id.trim(),
      title: add.title.trim(), problem: add.problem, desc: add.desc, solution: add.solution,
      benefit: add.benefit, submitter: add.submitter, submitter_name: sub ? sub.name : '',
      contributors: add.contributors, status: add.status, stage: add.stage, workflow: add.workflow,
      competency: add.competency, tags: add.tags, project_name: add.project_name,
      savings_type: add.savings_type, savings_amount: parseFloat(add.savings_amount) || 0,
      sprint: add.sprint, comments: add.comments, custom: add.custom,
    }), 'Idea added!')
    if (ok) setAdd(null)
  }
  function openEdit(i) {
    setEdit({ id: i.id, idea_id: i.idea_id || '', title: i.title || '', status: i.status, stage: i.stage || '',
      problem: i.problem || '', desc: i.description || i.desc || '', solution: i.solution || '',
      benefit: i.benefit || '', workflow: i.workflow || '', competency: i.competency || '',
      tags: i.tags || '', project_name: i.project_name || '', contributors: i.contributors || '',
      savings_type: i.savings_type || '', savings_amount: i.savings_amount || '',
      sprint: i.sprint || '', comments: i.comments || '', custom: { ...(i.custom || {}) } })
  }
  async function submitEdit() {
    const ok = await run(() => api.updateIdea(edit.id, {
      title: edit.title, status: edit.status, stage: edit.stage, problem: edit.problem,
      desc: edit.desc, solution: edit.solution, benefit: edit.benefit, workflow: edit.workflow,
      competency: edit.competency, tags: edit.tags, project_name: edit.project_name,
      savings_type: edit.savings_type, savings_amount: parseFloat(edit.savings_amount) || 0,
      contributors: edit.contributors, sprint: edit.sprint, comments: edit.comments, custom: edit.custom,
    }), 'Idea updated!')
    if (ok) setEdit(null)
  }
  async function del(id) {
    if (!window.confirm('Remove this idea?')) return
    run(() => api.deleteIdea(id), 'Removed')
  }

  const ideaPool = add ? members.filter((m) => !add.pod || m.pod === add.pod) : []
  const submitterOptions = ideaPool.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.id})</option>)
  const podOptionsIdea = [<option key="" value="">All PODs</option>].concat(
    data.pods.map((p) => <option key={p.code} value={p.code}>{p.name}</option>),
  )
  const statusOptions = STATUSES.map((s) => <option key={s}>{s}</option>)
  const savingsTypeOptions = [<option key="" value="">— None —</option>]
    .concat(SAVINGS_TYPES.map((s) => <option key={s} value={s}>{s}</option>))
  const sprintIdx = (s) => { const i = MONTHS.indexOf(s); return i < 0 ? 999 : i }
  const sprintNames = [...new Set(data.sprints.map((s) => s.sprint))].sort((a, b) => sprintIdx(a) - sprintIdx(b) || a.localeCompare(b))
  const sprintChoices = sprintNames.length ? sprintNames : MONTHS
  const sprintOptionEls = (current) => {
    const list = [...sprintChoices]
    if (current && !list.includes(current)) list.unshift(current)
    return [<option key="" value="">— Sprint —</option>].concat(list.map((s) => <option key={s} value={s}>{s}</option>))
  }

  return (
    <>
      <div className="tb"><h2>Ideas &amp; Innovations</h2>
        <div className="tb-r">
          <input placeholder="Search id / title / submitter…" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 200 }} />
          <select style={{ width: 'auto' }} value={stF} onChange={(e) => setStF(e.target.value)}>
            <option value="">All Status</option>
            {STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
          <select style={{ width: 'auto' }} value={slF} onChange={(e) => { setSlF(e.target.value); setPodF('') }}>
            <option value="">All Service Lines</option>
            {serviceLines.map((sl) => <option key={sl} value={sl}>{sl}</option>)}
            <option value={UNMAPPED}>Unmapped (no member){unmappedCount ? ` · ${unmappedCount}` : ''}</option>
          </select>
          <select style={{ width: 'auto' }} value={podF} onChange={(e) => setPodF(e.target.value)} disabled={slF === UNMAPPED}>
            <option value="">All PODs</option>
            {data.pods.filter((p) => !slF || slF === UNMAPPED || p.sl === slF).map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
          </select>
          {isAdmin && <button className="btn btn-p btn-sm" onClick={openAdd}>+ Add Idea</button>}
          <BulkUpload kind="idea" />
          <button className="btn btn-sm" onClick={() => exportCSV('ideas', data)}>&#8659; CSV</button>
        </div>
      </div>
      <div className="con">
        <div style={{ fontSize: 12, color: 'var(--mu)', marginBottom: 8 }}>
          Showing {rows.length} of {ideas.length} idea{ideas.length === 1 ? '' : 's'}
          {slF === UNMAPPED ? ' · submitters not matched to any current member' : ''}
        </div>
        {!rows.length ? <Empty>No ideas found</Empty> : (
          <div className="tw"><table>
            <thead><tr>
              <th>Idea ID</th><th>Title / Problem</th><th>Submitter</th><th>POD</th><th>Service Line</th><th>Stage</th><th>Workflow</th><th>Status</th>
              <th>Saving Type</th><th style={{ textAlign: 'right' }}>Savings ($)</th>
              <th>Sprint</th><th>Contributors</th>
              {cf.map((f) => <th key={f.id}>{f.label}</th>)}
              <th>Actions</th>
            </tr></thead>
            <tbody>
              {rows.map((idea) => {
                const sub = submitterLabel(members, idea)
                return (
                  <tr key={idea.id}>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--mu2)' }}>{idea.idea_id || '—'}</td>
                    <td style={{ maxWidth: 260 }}>
                      <div style={{ fontWeight: 500, fontSize: 12.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 250 }}>{idea.title || '-'}</div>
                      <div style={{ fontSize: 11, color: 'var(--mu)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 250 }}>{idea.problem || ''}</div>
                    </td>
                    <td style={{ minWidth: 150 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Avatar members={members} name={sub.name} size={26} />
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 500 }}>{sub.name}</div>
                          <div style={{ fontSize: 10, color: 'var(--mu)', fontFamily: 'var(--mono)' }}>{idea.submitter}</div>
                        </div>
                      </div>
                    </td>
                    <td>{sub.pod
                      ? <PodBadge pods={data.pods} code={sub.pod} podColor={podColor} />
                      : <span className="badge" style={{ background: 'var(--s3)', color: 'var(--mu)' }} title="Submitter is not a current member">Unmapped</span>}</td>
                    <td style={{ fontSize: 11.5, color: sub.sl ? 'var(--mu2)' : 'var(--mu)', whiteSpace: 'nowrap' }}>{sub.sl || '—'}</td>
                    <td style={{ fontSize: 11.5, color: 'var(--mu2)', whiteSpace: 'nowrap' }}>{idea.stage || '-'}</td>
                    <td style={{ fontSize: 11.5, color: 'var(--mu2)', whiteSpace: 'nowrap' }}>{idea.workflow || '-'}</td>
                    <td><StatusBadge status={idea.status} /></td>
                    <td>{idea.savings_type
                      ? <span className="badge" style={{ background: 'var(--s3)', color: idea.savings_type === 'Hard Dollar' ? 'var(--green)' : 'var(--teal, #14b8a6)', whiteSpace: 'nowrap' }}>{idea.savings_type}</span>
                      : <span style={{ fontSize: 11.5, color: 'var(--mu)' }}>—</span>}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 12, color: idea.savings_amount ? 'var(--green)' : 'var(--mu)' }}>{idea.savings_amount ? fmtUSD(idea.savings_amount) : '—'}</td>
                    <td style={{ fontSize: 12, color: idea.sprint ? 'var(--mu2)' : 'var(--mu)', whiteSpace: 'nowrap' }}>{idea.sprint || '-'}</td>
                    <td style={{ fontSize: 11.5, color: 'var(--mu2)', maxWidth: 200 }}>
                      <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 190 }} title={idea.contributors || ''}>{idea.contributors || '-'}</div>
                    </td>
                    {cf.map((f) => <td key={f.id} style={{ fontSize: 12, color: 'var(--mu2)' }}>{(idea.custom && idea.custom[f.id]) || '-'}</td>)}
                    <td><div style={{ display: 'flex', gap: 5 }}>
                      <button className="btn btn-sm" onClick={() => setView(idea)}>View</button>
                      {isAdmin && <>
                        <button className="btn btn-sm" onClick={() => openEdit(idea)}>Edit</button>
                        <button className="btn btn-sm btn-d" onClick={() => del(idea.id)}>X</button>
                      </>}
                    </div></td>
                  </tr>
                )
              })}
            </tbody>
          </table></div>
        )}
      </div>

      {/* Add */}
      <Modal open={!!add} title="Add Idea / Innovation" width="640px" onClose={() => setAdd(null)}
        footer={<><button className="btn" onClick={() => setAdd(null)}>Cancel</button><button className="btn btn-p" onClick={submitAdd}>Add Idea</button></>}>
        {add && <>
          <div className="fg2">
            <Field label="Idea ID *"><input value={add.idea_id} placeholder="e.g. 1010786" onChange={(e) => setAdd({ ...add, idea_id: e.target.value })} /></Field>
            <Field label="Idea Title *"><input value={add.title} placeholder="Short descriptive title" onChange={(e) => setAdd({ ...add, title: e.target.value })} /></Field>
          </div>
          <Field label="Problem Statement"><textarea value={add.problem} placeholder="What problem does this solve?" onChange={(e) => setAdd({ ...add, problem: e.target.value })} /></Field>
          <Field label="Description"><textarea style={{ minHeight: 80 }} value={add.desc} placeholder="Full description…" onChange={(e) => setAdd({ ...add, desc: e.target.value })} /></Field>
          <div className="fg2">
            <Field label="Solution"><textarea value={add.solution} onChange={(e) => setAdd({ ...add, solution: e.target.value })} /></Field>
            <Field label="Benefit"><textarea value={add.benefit} onChange={(e) => setAdd({ ...add, benefit: e.target.value })} /></Field>
          </div>
          <div className="fg3">
            <Field label="POD / Team"><select value={add.pod} onChange={(e) => setAddPod(e.target.value)}>{podOptionsIdea}</select></Field>
            <Field label="Submitter"><select value={add.submitter} onChange={(e) => setAdd({ ...add, submitter: e.target.value })}>{submitterOptions}</select></Field>
            <Field label="Status"><select value={add.status} onChange={(e) => setAdd({ ...add, status: e.target.value })}>{statusOptions}</select></Field>
          </div>
          <div className="fg2">
            <Field label="Dollar Saving Type"><select value={add.savings_type} onChange={(e) => setAdd({ ...add, savings_type: e.target.value })}>{savingsTypeOptions}</select></Field>
            <Field label="Savings Amount ($)"><input type="number" min="0" step="any" value={add.savings_amount} placeholder="e.g. 25000" onChange={(e) => setAdd({ ...add, savings_amount: e.target.value })} /></Field>
          </div>
          <div className="fg3">
            <Field label="Stage"><input list="idea-stages" value={add.stage} onChange={(e) => setAdd({ ...add, stage: e.target.value })} /><datalist id="idea-stages">{STAGES.map((s) => <option key={s} value={s} />)}</datalist></Field>
            <Field label="Workflow"><input value={add.workflow} onChange={(e) => setAdd({ ...add, workflow: e.target.value })} /></Field>
            <Field label="Competency"><input value={add.competency} onChange={(e) => setAdd({ ...add, competency: e.target.value })} /></Field>
          </div>
          <div className="fg2">
            <Field label="Project Name"><input value={add.project_name} onChange={(e) => setAdd({ ...add, project_name: e.target.value })} /></Field>
            <Field label="Tags"><input value={add.tags} placeholder="#GenAI, #AIML" onChange={(e) => setAdd({ ...add, tags: e.target.value })} /></Field>
          </div>
          <div className="fg2">
            <Field label="Sprint"><select value={add.sprint} onChange={(e) => setAdd({ ...add, sprint: e.target.value })}>{sprintOptionEls(add.sprint)}</select></Field>
            <Field label="Contributors (Name & ID, comma sep.)"><input value={add.contributors} placeholder="Surname,Given(123456)" onChange={(e) => setAdd({ ...add, contributors: e.target.value })} /></Field>
          </div>
          <Field label="Comments / Idea Details"><textarea style={{ minHeight: 80 }} value={add.comments} placeholder="Additional details, notes or context about the idea…" onChange={(e) => setAdd({ ...add, comments: e.target.value })} /></Field>
          <CustomFieldInputs fields={cf} values={add.custom} onChange={(id, v) => setAdd({ ...add, custom: { ...add.custom, [id]: v } })} />
        </>}
      </Modal>

      {/* Edit */}
      <Modal open={!!edit} title="Edit Idea" width="640px" onClose={() => setEdit(null)}
        footer={<><button className="btn" onClick={() => setEdit(null)}>Cancel</button><button className="btn btn-p" onClick={submitEdit}>Save</button></>}>
        {edit && <>
          <div className="fg2">
            <Field label="Idea ID"><input value={edit.idea_id} readOnly style={{ background: 'var(--s3)', color: 'var(--mu)' }} /></Field>
            <Field label="Title"><input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></Field>
          </div>
          <div className="fg3">
            <Field label="Stage"><input list="idea-stages-e" value={edit.stage} onChange={(e) => setEdit({ ...edit, stage: e.target.value })} /><datalist id="idea-stages-e">{STAGES.map((s) => <option key={s} value={s} />)}</datalist></Field>
            <Field label="Workflow"><input value={edit.workflow} onChange={(e) => setEdit({ ...edit, workflow: e.target.value })} /></Field>
            <Field label="Status"><select value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })}>{statusOptions}</select></Field>
          </div>
          <div style={{ fontSize: 11, color: 'var(--mu)', marginTop: -4, marginBottom: 8 }}>Setting a Stage re-derives Status automatically; leave Stage unchanged to set Status manually.</div>
          <div className="fg2">
            <Field label="Dollar Saving Type"><select value={edit.savings_type} onChange={(e) => setEdit({ ...edit, savings_type: e.target.value })}>{savingsTypeOptions}</select></Field>
            <Field label="Savings Amount ($)"><input type="number" min="0" step="any" value={edit.savings_amount} placeholder="e.g. 25000" onChange={(e) => setEdit({ ...edit, savings_amount: e.target.value })} /></Field>
          </div>
          <Field label="Problem Statement"><textarea value={edit.problem} onChange={(e) => setEdit({ ...edit, problem: e.target.value })} /></Field>
          <Field label="Description"><textarea style={{ minHeight: 70 }} value={edit.desc} onChange={(e) => setEdit({ ...edit, desc: e.target.value })} /></Field>
          <div className="fg2">
            <Field label="Solution"><textarea value={edit.solution} onChange={(e) => setEdit({ ...edit, solution: e.target.value })} /></Field>
            <Field label="Benefit"><textarea value={edit.benefit} onChange={(e) => setEdit({ ...edit, benefit: e.target.value })} /></Field>
          </div>
          <div className="fg3">
            <Field label="Sprint"><select value={edit.sprint} onChange={(e) => setEdit({ ...edit, sprint: e.target.value })}>{sprintOptionEls(edit.sprint)}</select></Field>
            <Field label="Competency"><input value={edit.competency} onChange={(e) => setEdit({ ...edit, competency: e.target.value })} /></Field>
            <Field label="Tags"><input value={edit.tags} onChange={(e) => setEdit({ ...edit, tags: e.target.value })} /></Field>
          </div>
          <div className="fg2">
            <Field label="Project Name"><input value={edit.project_name} onChange={(e) => setEdit({ ...edit, project_name: e.target.value })} /></Field>
            <Field label="Contributors"><input value={edit.contributors} onChange={(e) => setEdit({ ...edit, contributors: e.target.value })} /></Field>
          </div>
          <Field label="Comments / Idea Details"><textarea style={{ minHeight: 80 }} value={edit.comments} placeholder="Additional details, notes or context about the idea…" onChange={(e) => setEdit({ ...edit, comments: e.target.value })} /></Field>
          <CustomFieldInputs fields={cf} values={edit.custom} onChange={(id, v) => setEdit({ ...edit, custom: { ...edit.custom, [id]: v } })} />
        </>}
      </Modal>

      {/* View */}
      <Modal open={!!view} title={view ? (view.title || 'Untitled') : ''} width="660px" onClose={() => setView(null)}
        footer={<><button className="btn" onClick={() => setView(null)}>Close</button>{isAdmin && <button className="btn btn-p" onClick={() => { const v = view; setView(null); openEdit(v) }}>Edit</button>}</>}>
        {view && (() => {
          const sub = submitterLabel(members, view)
          const Row = ({ label, children }) => (children ? <div style={{ marginBottom: 8 }}><strong style={{ color: 'var(--tx)' }}>{label}:</strong> {children}</div> : null)
          return <>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
              <StatusBadge status={view.status} />
              {view.stage && <span className="badge" style={{ background: 'var(--s3)', color: 'var(--mu2)' }}>{view.stage}</span>}
              {view.idea_id && <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--mu)' }}>ID {view.idea_id}</span>}
              {view.rating ? <span style={{ fontSize: 11, color: 'var(--amber)' }}>★ {view.rating}</span> : null}
            </div>
            <div style={{ fontSize: 13, color: 'var(--mu2)', lineHeight: 1.7 }}>
              <Row label="Problem Statement">{view.problem}</Row>
              <Row label="Description">{view.description || view.desc}</Row>
              <Row label="Solution">{view.solution}</Row>
              <Row label="Benefit">{view.benefit}</Row>
              <Row label="Dollar Saving Type">{view.savings_type}</Row>
              <Row label="Savings Amount">{view.savings_amount ? fmtUSD(view.savings_amount) : ''}</Row>
              <Row label="Submitter">{sub.member ? `${sub.name} (${view.submitter})` : sub.name}</Row>
              <Row label="Contributors">{view.contributors}</Row>
              <Row label="Project">{view.project_name}</Row>
              <Row label="Workflow">{view.workflow}</Row>
              <Row label="Competency">{view.competency}</Row>
              <Row label="Source">{view.source}</Row>
              <Row label="Tags">{view.tags}</Row>
              <Row label="Sprint">{view.sprint}</Row>
              <Row label="Comments / Idea Details">{view.comments}</Row>
              <Row label="Created On">{view.created_on}</Row>
              {cf.map((f) => (view.custom && view.custom[f.id]) ? <Row key={f.id} label={f.label}>{view.custom[f.id]}</Row> : null)}
            </div>
          </>
        })()}
      </Modal>
    </>
  )
}
