import React from 'react'
import { useApp } from '../store'

// Standard "All PODs" dropdown used in several section toolbars.
// `extraOptions` (optional) appends extra {value,label} entries, e.g. an
// "Unmapped (no POD)" choice on the Ideas page.
export default function PodFilter({ value, onChange, extraOptions = [] }) {
  const { data } = useApp()
  return (
    <select style={{ width: 'auto' }} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">All PODs</option>
      {data.pods.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
      {extraOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}
