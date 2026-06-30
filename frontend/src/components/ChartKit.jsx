import React from 'react'
import { exportChartPNG, slugify } from '../lib/chartExport'

// A titled chart container. Shows a centered note when there is no data, and a
// "⤓ PNG" download button when a chartId (ApexCharts chart.id) is supplied.
export function Card({ title, height, children, note, chartId }) {
  const canDownload = chartId && !note
  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 8 }}>
        <div className="sh" style={{ marginBottom: 0 }}>{title}</div>
        {canDownload && (
          <button className="btn btn-sm" title="Download chart as PNG" style={{ flexShrink: 0 }}
            onClick={() => exportChartPNG(chartId, slugify(title))}>&#10515; PNG</button>
        )}
      </div>
      {note ? <div style={{ color: 'var(--mu)', fontSize: 12, padding: '30px 0', textAlign: 'center' }}>{note}</div>
        : <div style={{ height }}>{children}</div>}
    </div>
  )
}

// A signed delta chip ("▲ 3pp vs last sprint"). `invert` flips good/bad colours.
export function Delta({ value, unit, invert, suffix = 'vs last sprint' }) {
  if (value == null) return <span style={{ fontSize: 11, color: 'var(--mu)' }}>—</span>
  const up = value > 0
  const flat = value === 0
  const good = invert ? !up : up
  const color = flat ? 'var(--mu)' : good ? 'var(--green)' : 'var(--red)'
  return (
    <span style={{ fontSize: 11, fontWeight: 600, color }}>
      {flat ? '±' : up ? '▲' : '▼'} {Math.abs(value)}{unit} <span style={{ color: 'var(--mu)', fontWeight: 400 }}>{suffix}</span>
    </span>
  )
}

// A metric card with optional progress bar.
export function KpiCard({ label, value, valueColor, sub, pct, pctColor }) {
  return (
    <div className="mc">
      <div className="mc-l">{label}</div>
      <div className="mc-v" style={{ color: valueColor }}>{value}</div>
      <div className="mc-s">{sub}</div>
      {pct != null && <div className="mc-pb"><div className="mc-pf" style={{ width: Math.min(100, pct) + '%', background: pctColor || 'var(--blue)' }} /></div>}
    </div>
  )
}
