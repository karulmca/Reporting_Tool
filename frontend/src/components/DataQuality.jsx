import React from 'react'
import { useApp } from '../store'
import { Empty, StatusBadge } from './ui'
import { resolveContributorNames } from '../lib/helpers'

// Admin view that surfaces Employee-ID integrity problems so they can be fixed.
export default function DataQuality() {
  const { data, isAdmin, run, api } = useApp()
  const { members, ideas, sprints } = data
  const idset = new Set(members.map((m) => m.id))

  // Duplicate member names (possible same person with two Employee IDs).
  const byName = {}
  members.forEach((m) => { const k = (m.name || '').trim().toLowerCase(); (byName[k] = byName[k] || []).push(m) })
  const dupNames = Object.values(byName).filter((g) => g.length > 1)

  // Members with a missing / blank Employee ID.
  const noId = members.filter((m) => !m.id || !String(m.id).trim())

  // Ideas whose submitter/contributors don't resolve to an Employee ID.
  const badIdeas = ideas.map((i) => {
    const issues = []
    if (!i.submitter) issues.push('No submitter')
    else if (!idset.has(i.submitter)) issues.push(`Unknown submitter "${i.submitter}"`)
    const unknownC = resolveContributorNames(members, i.contributors).filter((c) => !c.member).map((c) => c.raw)
    if (unknownC.length) issues.push('Unknown contributor(s): ' + unknownC.join(', '))
    return issues.length ? { idea: i, issues } : null
  }).filter(Boolean)

  // Sprint entries pointing at an unknown Employee ID.
  const badSprints = sprints.filter((s) => !idset.has(s.member))

  // Training rows recorded against an unknown Employee ID.
  const badTraining = Object.keys(data.training.status || {}).filter((mid) => !idset.has(mid))

  const total = dupNames.length + noId.length + badIdeas.length + badSprints.length + badTraining.length

  const Metric = ({ label, n }) => (
    <div className="mc"><div className="mc-l">{label}</div><div className="mc-v" style={{ color: n ? 'var(--red)' : 'var(--green)' }}>{n}</div></div>
  )

  return (
    <>
      <div className="tb"><h2>Data Quality</h2><div className="tb-r"><span style={{ fontSize: 11, color: 'var(--mu)' }}>Employee ID is the key across Members, Ideas, Sprints &amp; Training</span></div></div>
      <div className="con">
        <div className="g4" style={{ marginBottom: 14 }}>
          <Metric label="Duplicate Names" n={dupNames.length} />
          <Metric label="Orphaned Ideas" n={badIdeas.length} />
          <Metric label="Orphaned Sprints" n={badSprints.length} />
          <Metric label="Members w/o ID" n={noId.length} />
        </div>

        {total === 0 && <div className="card"><div style={{ color: 'var(--green)', fontSize: 14 }}>&#10003; No data-integrity issues found. Every record maps to a valid Employee ID.</div></div>}

        {dupNames.length > 0 && (
          <div className="card" style={{ marginBottom: 12 }}>
            <div className="sh">Duplicate Member Names ({dupNames.length})</div>
            <div className="tw"><table>
              <thead><tr><th>Name</th><th>Employee IDs (same name)</th></tr></thead>
              <tbody>{dupNames.map((g, k) => (
                <tr key={k}><td>{g[0].name}</td><td style={{ fontFamily: 'var(--mono)' }}>{g.map((m) => `${m.id} (${m.pod || '—'})`).join('  ·  ')}</td></tr>
              ))}</tbody>
            </table></div>
          </div>
        )}

        {badIdeas.length > 0 && (
          <div className="card" style={{ marginBottom: 12 }}>
            <div className="sh">Orphaned Ideas ({badIdeas.length})</div>
            <div className="tw"><table>
              <thead><tr><th>Title</th><th>Status</th><th>Issue</th>{isAdmin && <th>Action</th>}</tr></thead>
              <tbody>{badIdeas.map(({ idea, issues }) => (
                <tr key={idea.id}>
                  <td>{idea.title || '-'}</td>
                  <td><StatusBadge status={idea.status} /></td>
                  <td style={{ color: 'var(--mu2)', fontSize: 12 }}>{issues.join('; ')}</td>
                  {isAdmin && <td><button className="btn btn-sm btn-d" onClick={() => { if (window.confirm('Delete this idea?')) run(() => api.deleteIdea(idea.id), 'Idea removed') }}>Delete</button></td>}
                </tr>
              ))}</tbody>
            </table></div>
          </div>
        )}

        {badSprints.length > 0 && (
          <div className="card" style={{ marginBottom: 12 }}>
            <div className="sh">Orphaned Sprint Entries ({badSprints.length})</div>
            <div className="tw"><table>
              <thead><tr><th>Unknown Emp ID</th><th>Sprint</th><th>Committed</th><th>Completed</th>{isAdmin && <th>Action</th>}</tr></thead>
              <tbody>{badSprints.map((s, k) => (
                <tr key={k}>
                  <td style={{ fontFamily: 'var(--mono)' }}>{s.member}</td>
                  <td>{s.sprint}</td><td>{s.committed}</td><td>{s.completed}</td>
                  {isAdmin && <td><button className="btn btn-sm btn-d" onClick={() => { if (window.confirm('Delete this sprint entry?')) run(() => api.deleteSprint(s.member, s.sprint), 'Sprint entry removed') }}>Delete</button></td>}
                </tr>
              ))}</tbody>
            </table></div>
          </div>
        )}

        {badTraining.length > 0 && (
          <div className="card" style={{ marginBottom: 12 }}>
            <div className="sh">Orphaned Training Records ({badTraining.length})</div>
            <div style={{ fontSize: 12, color: 'var(--mu2)' }}>Training statuses recorded for unknown Employee IDs: <span style={{ fontFamily: 'var(--mono)' }}>{badTraining.join(', ')}</span></div>
          </div>
        )}

        {noId.length > 0 && (
          <div className="card">
            <div className="sh">Members Without an Employee ID ({noId.length})</div>
            <div style={{ fontSize: 12, color: 'var(--mu2)' }}>{noId.map((m) => m.name).join(', ')}</div>
          </div>
        )}
      </div>
    </>
  )
}
