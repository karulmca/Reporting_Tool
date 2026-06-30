import { describe, it, expect } from 'vitest'
import {
  sprintCmp, velocitySeries, rollingAverage, burnUp, ideaForecast, kpis,
} from './analytics'

const sprints = [
  { sprint: "May'26", committed: 10, completed: 8 },
  { sprint: "June'26", committed: 20, completed: 18 },
  { sprint: "May'26", committed: 5, completed: 5 },
]

describe('sprintCmp', () => {
  it('orders known fiscal months by calendar', () => {
    expect(sprintCmp("May'26", "June'26")).toBeLessThan(0)
    expect(sprintCmp("June'26", "May'26")).toBeGreaterThan(0)
  })
  it('numeric-aware compare for unknown labels', () => {
    expect(sprintCmp('Sprint 9', 'Sprint 10')).toBeLessThan(0)
  })
  it('known months sort before unknown labels', () => {
    expect(sprintCmp("May'26", 'Sprint 1')).toBeLessThan(0)
  })
})

describe('velocitySeries', () => {
  it('aggregates committed/completed per sprint, ordered', () => {
    const v = velocitySeries(sprints)
    expect(v.months).toEqual(["May'26", "June'26"])
    expect(v.committed).toEqual([15, 20])
    expect(v.completed).toEqual([13, 18])
  })
})

describe('rollingAverage', () => {
  it('computes a trailing window average', () => {
    expect(rollingAverage([10, 20, 30], 3)).toEqual([10, 15, 20])
  })
})

describe('burnUp', () => {
  it('returns empty structure with no sprints', () => {
    expect(burnUp([])).toEqual({
      categories: [], committed: [], completed: [], projected: [], avgVelocity: 0,
    })
  })
  it('accumulates and projects future periods', () => {
    const b = burnUp(sprints, 3)
    expect(b.avgVelocity).toBe(15.5)            // (13+18)/2
    expect(b.committed).toEqual([15, 35, null, null, null])
    expect(b.completed).toEqual([13, 31, null, null, null])
    expect(b.categories).toHaveLength(5)         // 2 actual + 3 forecast
    expect(b.projected[b.projected.length - 1]).toBe(77.5) // 31 + 15.5*3
  })
})

describe('ideaForecast', () => {
  const members = [{ target: 5 }, { target: 5 }]
  it('computes target, implemented and remaining', () => {
    const ideas = [
      { status: 'Implemented' }, { status: 'Implemented' }, { status: 'Proposed' },
    ]
    const fc = ideaForecast(members, ideas, sprints)
    expect(fc.target).toBe(10)
    expect(fc.implemented).toBe(2)
    expect(fc.remaining).toBe(8)
    expect(fc.pct).toBe(20)
  })
  it('reports target met when nothing remains', () => {
    const ideas = Array.from({ length: 10 }, () => ({ status: 'Implemented' }))
    const fc = ideaForecast(members, ideas, sprints)
    expect(fc.remaining).toBe(0)
    expect(fc.onTrack).toBe(true)
    expect(fc.label).toBe('Target met')
  })
})

describe('kpis', () => {
  it('derives delivery rate and velocity headline', () => {
    const k = kpis([{ target: 5 }], [], sprints)
    expect(k.deliveryRate).toBe(89)       // round(31/35*100)
    expect(k.latestVelocity).toBe(18)
    expect(k.avgVelocity).toBe(15.5)
    expect(k.latestSprint).toBe("June'26")
  })
})
