import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const h = vi.hoisted(() => ({ ctx: null }))
vi.mock('../store', () => ({ useApp: () => h.ctx }))

import TestReport from './TestReport'

const REPORT = {
  generated_at: '2026-06-30 12:00:00',
  suites: [
    {
      name: 'backend', framework: 'pytest', passed: 69, failed: 0, skipped: 0,
      total: 69, duration: 3.3, success: true, ran_at: '2026-06-30 12:00:00',
      cases: [{ name: 'test_health_ok', suite: 'test_misc', status: 'passed', duration: 0.01, message: '' }],
    },
  ],
}

function makeCtx(overrides = {}) {
  return {
    api: {
      getTestReport: vi.fn(async () => REPORT),
      runTests: vi.fn(async () => REPORT),
    },
    toast: vi.fn(),
    ...overrides,
  }
}

beforeEach(() => { h.ctx = makeCtx() })
afterEach(() => vi.restoreAllMocks())

describe('TestReport', () => {
  it('shows the cached report summary on load', async () => {
    render(<TestReport />)
    expect(await screen.findByText(/All passing/i)).toBeInTheDocument()
    expect(screen.getByText(/69 \/ 69 tests passed/)).toBeInTheDocument()
    expect(h.ctx.api.getTestReport).toHaveBeenCalled()
  })

  it('shows an empty state when there are no suites', async () => {
    h.ctx.api.getTestReport = vi.fn(async () => ({ suites: [], generated_at: null }))
    render(<TestReport />)
    expect(await screen.findByText(/No test results yet/i)).toBeInTheDocument()
  })

  it('runs the backend suite when its button is clicked', async () => {
    const user = userEvent.setup()
    render(<TestReport />)
    await screen.findByText(/All passing/i)
    await user.click(screen.getByRole('button', { name: /Backend/i }))
    await waitFor(() => expect(h.ctx.api.runTests).toHaveBeenCalledWith('backend'))
  })

  it('surfaces a suite error message', async () => {
    h.ctx.api.getTestReport = vi.fn(async () => ({
      generated_at: 'now',
      suites: [{ name: 'frontend', framework: 'vitest', passed: 0, failed: 0, skipped: 0, total: 0, success: false, cases: [], error: 'Node not available' }],
    }))
    render(<TestReport />)
    expect(await screen.findByText(/Node not available/i)).toBeInTheDocument()
  })
})
