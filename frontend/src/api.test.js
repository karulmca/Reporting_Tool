import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as api from './api'

function mockFetch(impl) {
  const fn = vi.fn(impl)
  vi.stubGlobal('fetch', fn)
  return fn
}

function ok(data) {
  return Promise.resolve({ ok: true, status: 200, json: async () => data })
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('api request helper', () => {
  it('GET hits the right url with JSON headers', async () => {
    const f = mockFetch(() => ok([{ code: 'FE' }]))
    const out = await api.getPods()
    expect(out).toEqual([{ code: 'FE' }])
    const [url, opts] = f.mock.calls[0]
    expect(url).toBe('/api/pods')
    expect(opts.method).toBe('GET')
    expect(opts.headers['Content-Type']).toBe('application/json')
  })

  it('POST serializes the body', async () => {
    const f = mockFetch(() => ok({ code: 'NEW' }))
    await api.createPod({ code: 'NEW', name: 'New POD' })
    const [url, opts] = f.mock.calls[0]
    expect(url).toBe('/api/pods')
    expect(opts.method).toBe('POST')
    expect(JSON.parse(opts.body)).toEqual({ code: 'NEW', name: 'New POD' })
  })

  it('URL-encodes path params', async () => {
    const f = mockFetch(() => ok({ ok: true }))
    await api.deleteMember('A B/C')
    expect(f.mock.calls[0][0]).toBe('/api/members/A%20B%2FC')
  })

  it('throws the server-provided error message on non-ok', async () => {
    mockFetch(() => Promise.resolve({
      ok: false, status: 400, json: async () => ({ error: 'POD code already exists' }),
    }))
    await expect(api.createPod({ code: 'DUP' })).rejects.toThrow('POD code already exists')
  })

  it('falls back to HTTP status when no error body', async () => {
    mockFetch(() => Promise.resolve({
      ok: false, status: 500, json: async () => { throw new Error('no json') },
    }))
    await expect(api.getPods()).rejects.toThrow('HTTP 500')
  })
})

describe('backup helpers', () => {
  it('builds a per-backup download URL (encoded)', () => {
    expect(api.backupDownloadURL('bluebolt 1.db')).toBe('/api/backups/bluebolt%201.db/download')
  })
  it('exposes the simple full-DB backup URL', () => {
    expect(api.BACKUP_URL).toBe('/api/backup')
  })
  it('createBackup posts a label', async () => {
    const f = mockFetch(() => ok({ name: 'x.db' }))
    await api.createBackup('nightly')
    expect(JSON.parse(f.mock.calls[0][1].body)).toEqual({ label: 'nightly' })
  })
})
