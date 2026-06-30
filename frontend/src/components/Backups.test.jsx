import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Mock the store so the component gets a controlled context (api + helpers).
const h = vi.hoisted(() => ({ ctx: null }))
vi.mock('../store', () => ({ useApp: () => h.ctx }))

import Backups from './Backups'

function makeCtx(overrides = {}) {
  return {
    api: {
      getBackups: vi.fn(async () => []),
      createBackup: vi.fn(async () => ({ name: 'bluebolt_x.db' })),
      restoreBackup: vi.fn(async () => ({})),
      deleteBackup: vi.fn(async () => ({})),
    },
    toast: vi.fn(),
    loadAll: vi.fn(async () => {}),
    isAdmin: true,
    ...overrides,
  }
}

beforeEach(() => { h.ctx = makeCtx() })
afterEach(() => { vi.restoreAllMocks() })

describe('Backups', () => {
  it('shows the empty state when there are no backups', async () => {
    render(<Backups />)
    expect(await screen.findByText(/No backups yet/i)).toBeInTheDocument()
    expect(h.ctx.api.getBackups).toHaveBeenCalled()
  })

  it('lists backups returned by the API', async () => {
    h.ctx.api.getBackups = vi.fn(async () => [
      { name: 'bluebolt_20260630_120000_nightly.db', size: 2048, created: '2026-06-30 12:00:00' },
    ])
    render(<Backups />)
    expect(await screen.findByText('bluebolt_20260630_120000_nightly.db')).toBeInTheDocument()
    expect(screen.getByText('2.0 KB')).toBeInTheDocument()
  })

  it('creates a backup with the typed label', async () => {
    const user = userEvent.setup()
    render(<Backups />)
    await screen.findByText(/No backups yet/i)

    await user.click(screen.getByRole('button', { name: /Create Backup/i }))
    const input = await screen.findByPlaceholderText(/before-sprint-import/i)
    await user.type(input, 'nightly')
    // The modal's confirm button is labelled "Create".
    await user.click(screen.getByRole('button', { name: /^Create$/ }))

    await waitFor(() => expect(h.ctx.api.createBackup).toHaveBeenCalledWith('nightly'))
    expect(h.ctx.toast).toHaveBeenCalled()
  })

  it('hides admin actions when not admin', async () => {
    h.ctx = makeCtx({ isAdmin: false })
    render(<Backups />)
    await screen.findByText(/No backups yet/i)
    expect(screen.queryByRole('button', { name: /Create Backup/i })).not.toBeInTheDocument()
  })
})
