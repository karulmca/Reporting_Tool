// Velocity & forecasting analytics derived from sprints / ideas / members.
import { MONTHS, implCount } from './helpers'

export function monthIndex(name) {
  const i = MONTHS.indexOf(name)
  return i === -1 ? 999 : i
}

// Natural sprint order: known months along the fiscal calendar, otherwise a
// numeric-aware compare so "Sprint 9" precedes "Sprint 10".
export function sprintCmp(a, b) {
  const ia = MONTHS.indexOf(a); const ib = MONTHS.indexOf(b)
  if (ia !== -1 && ib !== -1) return ia - ib
  if (ia !== -1) return -1
  if (ib !== -1) return 1
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })
}

// Per-sprint committed/completed totals, ordered naturally.
export function velocitySeries(sprints) {
  const byMonth = {}
  sprints.forEach((s) => {
    const m = (byMonth[s.sprint] ||= { committed: 0, completed: 0 })
    m.committed += s.committed
    m.completed += s.completed
  })
  const months = Object.keys(byMonth).sort(sprintCmp)
  return {
    months,
    committed: months.map((m) => byMonth[m].committed),
    completed: months.map((m) => byMonth[m].completed),
  }
}

// Trailing average over a window (used for the velocity trend line).
export function rollingAverage(arr, window = 3) {
  return arr.map((_, i) => {
    const slice = arr.slice(Math.max(0, i - window + 1), i + 1)
    return Math.round((slice.reduce((a, b) => a + b, 0) / slice.length) * 10) / 10
  })
}

const round1 = (n) => Math.round(n * 10) / 10

// Generate the next `count` forecast category labels. If every sprint shares a
// "<prefix><number>" shape (e.g. "Sprint 7"), continue the numbering; otherwise
// fall back to generic "Forecast +k" labels.
function nextLabels(names, count) {
  const last = names[names.length - 1]
  const m = /^(.*?)(\d+)\s*$/.exec(last || '')
  if (m) {
    const prefix = m[1]
    const allMatch = names.every((nm) => { const mm = /^(.*?)(\d+)\s*$/.exec(nm); return mm && mm[1] === prefix })
    if (allMatch) { let num = parseInt(m[2], 10); return Array.from({ length: count }, () => prefix + (++num)) }
  }
  return Array.from({ length: count }, (_, i) => 'Forecast +' + (i + 1))
}

// Cumulative burn-up over the ordered sprint sequence + a projected line that
// extends a few periods beyond the last actual using average velocity.
export function burnUp(sprints, forecast = 3) {
  const v = velocitySeries(sprints)
  const n = v.months.length
  if (!n) return { categories: [], committed: [], completed: [], projected: [], avgVelocity: 0 }

  const avgVelocity = round1(v.completed.reduce((a, b) => a + b, 0) / n)
  let cumC = 0; let cumD = 0
  const committed = []; const completed = []; const projected = []
  v.months.forEach((_, k) => {
    cumC += v.committed[k]; cumD += v.completed[k]
    committed.push(cumC); completed.push(cumD)
    projected.push(k === n - 1 ? cumD : null) // anchor the forecast to the last actual
  })
  const future = nextLabels(v.months, forecast)
  future.forEach((_, i) => { committed.push(null); completed.push(null); projected.push(round1(cumD + avgVelocity * (i + 1))) })
  return { categories: [...v.months, ...future], committed, completed, projected, avgVelocity }
}

// Forecast for the annual idea target, using implementation rate per sprint.
export function ideaForecast(members, ideas, sprints) {
  const v = velocitySeries(sprints)
  const elapsed = v.months.length
  const target = members.reduce((a, m) => a + m.target, 0)
  const implemented = ideas.filter((i) => i.status === 'Implemented').length
  const remaining = Math.max(0, target - implemented)
  const ratePerSprint = elapsed ? implemented / elapsed : 0
  const pct = target ? Math.round((implemented / target) * 100) : 0

  let projectedMonth = null
  let sprintsToTarget = null
  let onTrack = false
  let label = 'No sprint data'
  if (elapsed && ratePerSprint > 0) {
    sprintsToTarget = Math.ceil(remaining / ratePerSprint)
    const lastIdx = monthIndex(v.months[v.months.length - 1])
    const projIdx = lastIdx + sprintsToTarget
    const fiscalEnd = MONTHS.length - 1
    onTrack = projIdx <= fiscalEnd
    if (remaining === 0) { label = 'Target met'; onTrack = true; projectedMonth = v.months[v.months.length - 1] }
    else if (projIdx <= fiscalEnd) { projectedMonth = MONTHS[projIdx]; label = 'On track · ' + projectedMonth }
    else { projectedMonth = 'beyond ' + MONTHS[fiscalEnd]; label = 'At risk · ' + projectedMonth }
  } else if (remaining === 0 && target) {
    label = 'Target met'; onTrack = true
  }
  return { target, implemented, remaining, ratePerSprint: round1(ratePerSprint), pct, projectedMonth, sprintsToTarget, onTrack, label }
}

// Headline KPIs with deltas comparing the latest sprint to the previous one.
export function kpis(members, ideas, sprints) {
  const v = velocitySeries(sprints)
  const n = v.months.length
  const totalC = v.committed.reduce((a, b) => a + b, 0)
  const totalD = v.completed.reduce((a, b) => a + b, 0)
  const deliveryRate = totalC ? Math.round((totalD / totalC) * 100) : 0

  const rate = (i) => (v.committed[i] ? Math.round((v.completed[i] / v.committed[i]) * 100) : 0)
  const latestRate = n ? rate(n - 1) : 0
  const prevRate = n > 1 ? rate(n - 2) : null
  const latestVel = n ? v.completed[n - 1] : 0
  const prevVel = n > 1 ? v.completed[n - 2] : null
  const avgVel = n ? round1(totalD / n) : 0

  const fc = ideaForecast(members, ideas, sprints)
  return {
    deliveryRate,
    deliveryDelta: prevRate == null ? null : latestRate - prevRate,
    latestVelocity: latestVel,
    velocityDelta: prevVel == null ? null : round1(latestVel - prevVel),
    avgVelocity: avgVel,
    implemented: fc.implemented,
    target: fc.target,
    targetPct: fc.pct,
    gap: fc.remaining,
    forecast: fc,
    latestSprint: n ? v.months[n - 1] : null,
  }
}
