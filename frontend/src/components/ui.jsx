import React from 'react'
import { initials, avBG, avFG, statusClass } from '../lib/helpers'

export function Avatar({ members, name, size = 30, fontSize, style, title }) {
  const fs = fontSize || (size <= 24 ? 9 : size <= 26 ? 10 : 11)
  return (
    <div className="av" title={title} style={{ width: size, height: size, fontSize: fs, background: avBG(members, name), color: avFG(members, name), ...style }}>
      {initials(name)}
    </div>
  )
}

export function StatusBadge({ status }) {
  return <span className={'badge ' + statusClass(status)}>{status}</span>
}

export function PodBadge({ pods, code, podColor }) {
  const col = podColor(pods, code)
  return <span className="badge" style={{ background: col + '22', color: col }}>{code}</span>
}

export function Empty({ children }) {
  return <div style={{ textAlign: 'center', padding: 40, color: 'var(--mu)' }}>{children}</div>
}

// Generic modal. Click on the dark overlay closes it.
export function Modal({ open, title, onClose, children, footer, width }) {
  if (!open) return null
  return (
    <div className="ov" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" style={width ? { width } : undefined}>
        <h3>{title}</h3>
        {children}
        {footer && <div className="mfoot">{footer}</div>}
      </div>
    </div>
  )
}

export function Field({ label, children }) {
  return (
    <div className="fr">
      <label className="fl">{label}</label>
      {children}
    </div>
  )
}
