import { describe, it, expect } from 'vitest'
import {
  fmtUSD, sumSavings, initials, memberByID, memberName, podColor,
  statusClass, implCount, progCount, resolveContributorNames, PAL,
} from './helpers'

const members = [
  { id: '1', name: 'Arul Kuppusamy' },
  { id: '2', name: 'Priya Sharma' },
]
const pods = [
  { code: 'FE', color: '#111111' },
  { code: 'BE', color: '' },
]
const ideas = [
  { submitter: '1', status: 'Implemented', savings_type: 'Hard Dollar', savings_amount: 5000 },
  { submitter: '1', status: 'In Progress', savings_type: 'Soft Dollar', savings_amount: 1000 },
  { submitter: '2', status: 'Implemented', savings_type: '', savings_amount: 0 },
]

describe('fmtUSD', () => {
  it('formats plain, thousands and millions', () => {
    expect(fmtUSD(500)).toBe('$500')
    expect(fmtUSD(25000)).toBe('$25K')
    expect(fmtUSD(1500)).toBe('$1.5K')
    expect(fmtUSD(2000000)).toBe('$2M')
    expect(fmtUSD(1200000)).toBe('$1.2M')
  })
  it('treats junk as zero', () => {
    expect(fmtUSD(undefined)).toBe('$0')
    expect(fmtUSD('abc')).toBe('$0')
  })
})

describe('sumSavings', () => {
  it('sums all savings', () => {
    expect(sumSavings(ideas)).toBe(6000)
  })
  it('filters by type', () => {
    expect(sumSavings(ideas, 'Hard Dollar')).toBe(5000)
    expect(sumSavings(ideas, 'Soft Dollar')).toBe(1000)
  })
})

describe('initials', () => {
  it('takes first two name parts, upper-cased', () => {
    expect(initials('Arul Kuppusamy')).toBe('AK')
    expect(initials('Kuppusamy, Arul')).toBe('KA')
    expect(initials('Madonna')).toBe('M')
    expect(initials('')).toBe('')
  })
})

describe('member lookups', () => {
  it('finds a member by (string) id', () => {
    expect(memberByID(members, 1).name).toBe('Arul Kuppusamy')
    expect(memberByID(members, '2').name).toBe('Priya Sharma')
  })
  it('memberName falls back to the id when unknown', () => {
    expect(memberName(members, '1')).toBe('Arul Kuppusamy')
    expect(memberName(members, '999')).toBe('999')
  })
})

describe('podColor', () => {
  it('uses the pod color when set', () => {
    expect(podColor(pods, 'FE')).toBe('#111111')
  })
  it('falls back to the palette by index when missing', () => {
    expect(podColor(pods, 'BE')).toBe(PAL[1])
  })
})

describe('status + counts', () => {
  it('maps status to a css class with fallback', () => {
    expect(statusClass('Implemented')).toBe('bg')
    expect(statusClass('Whatever')).toBe('ba')
  })
  it('counts implemented and in-progress per submitter', () => {
    expect(implCount(ideas, '1')).toBe(1)
    expect(progCount(ideas, '1')).toBe(1)
    expect(implCount(ideas, 2)).toBe(1)
  })
})

describe('resolveContributorNames', () => {
  it('resolves ids to member names, keeping unknowns raw', () => {
    const out = resolveContributorNames(members, '1, 999')
    expect(out).toHaveLength(2)
    expect(out[0].name).toBe('Arul Kuppusamy')
    expect(out[1].name).toBe('999')
    expect(out[1].member).toBeUndefined()
  })
  it('returns empty for blank input', () => {
    expect(resolveContributorNames(members, '')).toEqual([])
  })
})
