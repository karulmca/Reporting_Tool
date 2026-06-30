import React from 'react'
import { useApp } from '../store'
import { BACKUP_URL } from '../api'

const I = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, viewBox: '0 0 24 24' }

const icons = {
  dashboard: (<svg {...I}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>),
  members: (<svg {...I}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>),
  ideas: (<svg {...I}><circle cx="12" cy="12" r="10" /><path d="M12 8v4l3 3" /></svg>),
  sprints: (<svg {...I}><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>),
  training: (<svg {...I}><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></svg>),
  graphs: (<svg {...I}><path d="M3 3v18h18" /><path d="M7 16l4-4 3 3 5-6" /></svg>),
  'member-analytics': (<svg {...I}><circle cx="9" cy="7" r="3" /><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" /><path d="M16 11l2.5 2.5L22 9" /></svg>),
  pods: (<svg {...I}><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" /></svg>),
  fields: (<svg {...I}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z" /></svg>),
  audit: (<svg {...I}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14,2 14,8 20,8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>),
  'data-quality': (<svg {...I}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" /></svg>),
  backups: (<svg {...I}><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M3 5v6c0 1.66 4 3 9 3s9-1.34 9-3V5" /><path d="M3 11v6c0 1.66 4 3 9 3s9-1.34 9-3v-6" /></svg>),
  defects: (<svg {...I}><path d="M12 2l3 3M9 5l3-3M12 8v13" /><rect x="7" y="8" width="10" height="9" rx="3" /><path d="M3 11h4M17 11h4M3 16h4M17 16h4" /></svg>),
  'scrum-board': (<svg {...I}><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 3v18M15 3v18" /><path d="M5 7h2M11 7h2M17 7h2" /></svg>),
  'board-settings': (<svg {...I}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>),
}

const GROUPS = [
  { group: 'Overview', items: [{ id: 'dashboard', label: 'Dashboard' }] },
  { group: 'Tracking', items: [{ id: 'members', label: 'Members', badge: 'members' }, { id: 'ideas', label: 'Ideas', badge: 'ideas' }, { id: 'sprints', label: 'Sprint Tracker' }, { id: 'scrum-board', label: 'Scrum Board' }, { id: 'training', label: 'Training' }] },
  { group: 'Analytics', items: [{ id: 'graphs', label: 'Graphs & Progress' }, { id: 'member-analytics', label: 'Member Progress' }, { id: 'defects', label: 'Defect Density' }] },
  { group: 'Admin', items: [{ id: 'pods', label: 'PODs / Teams' }, { id: 'fields', label: 'Custom Fields' }, { id: 'board-settings', label: 'Board Settings' }, { id: 'data-quality', label: 'Data Quality' }, { id: 'audit', label: 'Audit Log' }, { id: 'backups', label: 'Backups' }] },
]

export default function Sidebar({ active, onNav }) {
  const { data, status, isAdmin, setIsAdmin, checkHealth, loadAll, toast } = useApp()
  const counts = { members: data.members.length, ideas: data.ideas.length }

  return (
    <nav className="sb">
      <div className="sb-head">
        <div className="sb-logo">
          <div className="sb-icon">&#9889;</div>
          <div><h1>BlueBolt</h1><div className="sb-sub">Innovation Tracker</div></div>
        </div>
      </div>
      <div className="sb-nav">
        {GROUPS.map((g) => (
          <React.Fragment key={g.group}>
            <div className="nav-g">{g.group}</div>
            {g.items.map((it) => (
              <div key={it.id} className={'ni' + (active === it.id ? ' active' : '')} onClick={() => onNav(it.id)}>
                {icons[it.id]}
                {it.label}
                {it.badge && <span className="bc">{counts[it.badge]}</span>}
              </div>
            ))}
          </React.Fragment>
        ))}
      </div>
      <div className="sb-foot">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'var(--s2)', borderRadius: 8, cursor: 'pointer', marginBottom: 6 }} onClick={checkHealth}>
          <div className={'sdot ' + status.state} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, color: 'var(--mu2)' }}>{status.label}</div>
            <div style={{ fontSize: 10, color: 'var(--mu)' }}>localhost:8080</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-sm" style={{ flex: 1 }} onClick={() => { setIsAdmin(!isAdmin); toast(!isAdmin ? 'Admin mode' : 'View mode', 'i') }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: isAdmin ? 'var(--green)' : 'var(--amber)', flexShrink: 0 }} />
            <span>{isAdmin ? 'Admin' : 'View'}</span>
          </button>
          <button className="btn btn-sm" title="Download DB backup" onClick={() => { window.open(BACKUP_URL, '_blank'); toast('Downloading backup...', 'i') }}>&#128190;</button>
          <button className="btn btn-sm" title="Refresh data" onClick={() => loadAll()}>&#8635;</button>
        </div>
      </div>
    </nav>
  )
}
