import React, { useState, useEffect, useCallback } from 'react'
import { useApp } from '../store'
import { Empty } from './ui'

const ST_COL = { passed: 'var(--green)', failed: 'var(--red)', skipped: 'var(--amber)' }

function fmtDur(sec) {
  if (!sec) return '—'
  return sec < 1 ? Math.round(sec * 1000) + 'ms' : sec.toFixed(1) + 's'
}

function SuiteCard({ suite }) {
  const [open, setOpen] = useState(suite.failed > 0)  // auto-expand failures
  const ok = suite.success && !suite.error
  const accent = suite.error ? 'var(--amber)' : ok ? 'var(--green)' : 'var(--red)'

  // Group cases by their file/suite.
  const groups = {}
  for (const c of suite.cases || []) (groups[c.suite] ||= []).push(c)

  return (
    <div className="card" style={{ borderLeft: `3px solid ${accent}`, marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', cursor: 'pointer' }}
        onClick={() => setOpen((o) => !o)}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, textTransform: 'capitalize' }}>
            {suite.name} <span style={{ color: 'var(--mu)', fontWeight: 400, fontSize: 12 }}>({suite.framework})</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--mu)' }}>
            {suite.ran_at ? 'Ran ' + suite.ran_at : 'Not run yet'} · {fmtDur(suite.duration)}
          </div>
        </div>
        {!suite.error && <>
          <span className="badge" style={{ background: 'var(--green)22', color: 'var(--green)' }}>{suite.passed} passed</span>
          {suite.failed > 0 && <span className="badge" style={{ background: 'var(--red)22', color: 'var(--red)' }}>{suite.failed} failed</span>}
          {suite.skipped > 0 && <span className="badge" style={{ background: 'var(--amber)22', color: 'var(--amber)' }}>{suite.skipped} skipped</span>}
          <span style={{ color: 'var(--mu2)', fontSize: 12 }}>{suite.total} total</span>
        </>}
        <span style={{ color: 'var(--mu)', fontSize: 12, width: 14, textAlign: 'center' }}>{open ? '▾' : '▸'}</span>
      </div>

      {suite.error && (
        <div style={{ padding: '0 14px 12px' }}>
          <pre style={{ background: 'var(--s3)', color: 'var(--red)', padding: 10, borderRadius: 6, fontSize: 11, whiteSpace: 'pre-wrap', margin: 0, maxHeight: 180, overflow: 'auto' }}>{suite.error}</pre>
        </div>
      )}

      {open && !suite.error && (
        <div style={{ padding: '0 14px 12px' }}>
          {Object.keys(groups).sort().map((g) => (
            <div key={g} style={{ marginTop: 8 }}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--mu2)', margin: '6px 0 2px' }}>{g}</div>
              {groups[g].map((c, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '3px 0', borderTop: '1px solid var(--bd)' }}>
                  <span style={{ color: ST_COL[c.status] || 'var(--mu)', fontSize: 13, width: 14, flexShrink: 0 }}>
                    {c.status === 'passed' ? '✓' : c.status === 'failed' ? '✗' : '○'}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12 }}>{c.name}</div>
                    {c.message && (
                      <pre style={{ background: 'var(--s3)', color: 'var(--red)', padding: 8, borderRadius: 6, fontSize: 11, whiteSpace: 'pre-wrap', margin: '4px 0 2px', maxHeight: 160, overflow: 'auto' }}>{c.message}</pre>
                    )}
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--mu)', flexShrink: 0 }}>{fmtDur(c.duration)}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function TestReport() {
  const { api, toast } = useApp()
  const [report, setReport] = useState(null)
  const [err, setErr] = useState(false)
  const [busy, setBusy] = useState('')

  const load = useCallback(async () => {
    setErr(false)
    try { setReport(await api.getTestReport()) } catch { setErr(true) }
  }, [api])

  useEffect(() => { load() }, [load])

  const run = async (suite) => {
    setBusy(suite)
    toast('Running ' + suite + ' tests…', 'i')
    try {
      const r = await api.runTests(suite)
      setReport(r)
      const failed = (r.suites || []).reduce((a, s) => a + (s.failed || 0), 0)
      toast(failed ? failed + ' test(s) failed' : 'All tests passed', failed ? 'e' : 's')
    } catch (e) {
      toast('Error: ' + e.message, 'e')
    } finally { setBusy('') }
  }

  const suites = report?.suites || []
  const totals = suites.reduce((a, s) => ({
    passed: a.passed + (s.passed || 0), failed: a.failed + (s.failed || 0), total: a.total + (s.total || 0),
  }), { passed: 0, failed: 0, total: 0 })

  return (
    <>
      <div className="tb">
        <h2>Test Report</h2>
        <div className="tb-r" style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-sm" onClick={() => run('backend')} disabled={!!busy}>
            {busy === 'backend' ? 'Running…' : '▷ Backend'}
          </button>
          <button className="btn btn-sm" onClick={() => run('frontend')} disabled={!!busy}>
            {busy === 'frontend' ? 'Running…' : '▷ Frontend'}
          </button>
          <button className="btn btn-sm btn-p" onClick={() => run('all')} disabled={!!busy}>
            {busy === 'all' ? 'Running…' : '▷ Run All'}
          </button>
        </div>
      </div>
      <div className="con">
        {err ? <Empty>Could not load test report</Empty>
          : !report ? <Empty>Loading…</Empty>
            : !suites.length ? <Empty>No test results yet. Click “Run All” to run the suites.</Empty> : (
              <>
                <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
                  <div style={{ fontSize: 26, fontWeight: 700, color: totals.failed ? 'var(--red)' : 'var(--green)' }}>
                    {totals.failed ? '✗ ' + totals.failed + ' failing' : '✓ All passing'}
                  </div>
                  <div style={{ color: 'var(--mu2)', fontSize: 13 }}>
                    {totals.passed} / {totals.total} tests passed
                  </div>
                  {report.generated_at && <div style={{ color: 'var(--mu)', fontSize: 12 }}>· updated {report.generated_at}</div>}
                </div>
                {suites.map((s) => <SuiteCard key={s.name} suite={s} />)}
                {busy && <div style={{ color: 'var(--mu)', fontSize: 12, marginTop: 8 }}>Running {busy} suite — this can take up to ~30s…</div>}
              </>
            )}
      </div>
    </>
  )
}
