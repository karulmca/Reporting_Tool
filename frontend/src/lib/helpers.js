// Shared, pure helpers (palette, avatars, lookups, counts).

export const PAL = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6', '#f97316', '#ec4899']
export const AV_BG = ['rgba(59,130,246,.2)', 'rgba(34,197,94,.2)', 'rgba(245,158,11,.2)', 'rgba(139,92,246,.2)', 'rgba(20,184,166,.2)', 'rgba(249,115,22,.2)']
export const AV_TX = ['#93c5fd', '#86efac', '#fcd34d', '#c4b5fd', '#5eead4', '#fdba74']
export const STATUS_COL = { Implemented: '#22c55e', 'In Progress': '#3b82f6', 'POC Stage': '#14b8a6', Proposed: '#8b5cf6', New: '#f97316', Ideation: '#f59e0b' }
export const STATUS_CLS = { Implemented: 'bg', 'In Progress': 'bb', 'POC Stage': 'bt', Proposed: 'bp', New: 'bor', Ideation: 'ba' }
export const STATUSES = ['Implemented', 'In Progress', 'POC Stage', 'Proposed', 'New', 'Ideation']
export const MONTHS = ["Oct'25", "Nov'25", "Dec'25", "Jan'26", "Feb'26", "Mar'26", "Apr'26", "May'26", "June'26", "July'26", "Aug'26"]
// Dollar-savings classification for an idea (blank = no savings recorded).
export const SAVINGS_TYPES = ['Soft Dollar', 'Hard Dollar']
export const SAVINGS_COL = { 'Hard Dollar': '#22c55e', 'Soft Dollar': '#14b8a6' }

// Format a number as a compact USD amount (e.g. $25,000 / $1.2M).
export function fmtUSD(n) {
  const v = Number(n) || 0
  if (Math.abs(v) >= 1e6) return '$' + (v / 1e6).toFixed(v % 1e6 ? 1 : 0) + 'M'
  if (Math.abs(v) >= 1e3) return '$' + (v / 1e3).toFixed(v % 1e3 ? 1 : 0) + 'K'
  return '$' + v.toLocaleString('en-US', { maximumFractionDigits: 0 })
}
// Sum the dollar savings across a list of ideas (optionally filtered by type).
export function sumSavings(ideas, type) {
  return ideas.reduce((a, i) => a + ((!type || i.savings_type === type) ? (Number(i.savings_amount) || 0) : 0), 0)
}

export function initials(n) {
  return (n || '').split(/[ ,]/).filter(Boolean).map((x) => x[0]).join('').toUpperCase().slice(0, 2)
}
export function memberByID(members, id) {
  return members.find((m) => m.id === String(id))
}
export function memberName(members, id) {
  const m = memberByID(members, id)
  return m ? m.name : String(id)
}
export function podColor(pods, code) {
  const p = pods.find((x) => x.code === code)
  if (p && p.color) return p.color
  const i = pods.findIndex((x) => x.code === code)
  return PAL[Math.max(0, i) % PAL.length]
}
export function avBG(members, name) {
  const i = members.findIndex((m) => m.name === name)
  return AV_BG[Math.max(0, i) % AV_BG.length]
}
export function avFG(members, name) {
  const i = members.findIndex((m) => m.name === name)
  return AV_TX[Math.max(0, i) % AV_TX.length]
}
export function statusClass(st) {
  return STATUS_CLS[st] || 'ba'
}
export function implCount(ideas, id) {
  return ideas.filter((i) => i.submitter === String(id) && i.status === 'Implemented').length
}
export function progCount(ideas, id) {
  return ideas.filter((i) => i.submitter === String(id) && i.status === 'In Progress').length
}
// Resolve comma-separated contributor ids to {raw, member, name}
export function resolveContributorNames(members, contributorsStr) {
  if (!contributorsStr) return []
  return String(contributorsStr)
    .split(',')
    .map((raw) => {
      raw = raw.trim()
      if (!raw) return null
      const member = memberByID(members, raw)
      return { raw, member, name: member ? member.name : raw }
    })
    .filter(Boolean)
}
