import React, { useState, useMemo, useEffect } from 'react'
import Chart from 'react-apexcharts'
import { useApp } from '../store'
import { StatusBadge } from './ui'
import { Card } from './ChartKit'
import { memberName, STATUSES, STATUS_COL, PAL, sumSavings, fmtUSD } from '../lib/helpers'
import { AX, merge } from '../lib/chartTheme'
import { exportDashboardReportExcel } from '../lib/reportExport'

const PIPELINE = ['POC Stage', 'Proposed', 'New', 'Ideation']

export default function Dashboard({ onNav }) {
  const { data, toast, loadAll } = useApp()
  const allMembers = data.members
  const { pods } = data
  const [slF, setSlF] = useState('')
  const [podF, setPodF] = useState('')
  const [exporting, setExporting] = useState(false)

  // Always pull the latest records from the server whenever the Dashboard is
  // opened, so the KPIs reflect the current database (not just the 30s poll).
  useEffect(() => { loadAll() }, [loadAll])

  async function downloadExcel() {
    setExporting(true)
    try {
      // Default (no filter) → full report unchanged. When a Service Line (and
      // optionally a POD) is selected, scope the report to that SL and its PODs.
      let reportData = data
      let opts = {}
      if (slF || podF) {
        reportData = {
          ...data,
          members,
          pods: pods.filter((p) => !slF || p.sl === slF),
          ideas,
          sprints: data.sprints.filter((s) => mids.has(s.member)),
        }
        const podName = podF ? (pods.find((p) => p.code === podF)?.name || podF) : ''
        opts = { scopeLabel: [slF, podName].filter(Boolean).join(' · ') }
      }
      await exportDashboardReportExcel(reportData, opts)
      toast('Excel report downloaded', 's')
    } catch (e) {
      toast('Report failed: ' + e.message, 'e')
    } finally {
      setExporting(false)
    }
  }

  // Distinct Service Lines, sourced from PODs and members.
  const serviceLines = useMemo(() => {
    const s = new Set()
    pods.forEach((p) => p.sl && s.add(p.sl))
    allMembers.forEach((m) => m.sl && s.add(m.sl))
    return [...s].sort((a, b) => a.localeCompare(b))
  }, [pods, allMembers])

  // Resolve an idea's Service Line / POD via its submitter's current member.
  const memById = useMemo(() => Object.fromEntries(allMembers.map((m) => [m.id, m])), [allMembers])
  const slOf = (i) => { const m = memById[i.submitter]; return m ? (m.sl || 'Unassigned') : 'Unmapped' }

  // --- Scope everything to the chosen Service Line + POD ------------------
  let members = allMembers
  if (slF) members = members.filter((m) => m.sl === slF)
  if (podF) members = members.filter((m) => m.pod === podF)
  const mids = new Set(members.map((m) => m.id))
  const ideas = (slF || podF) ? data.ideas.filter((i) => mids.has(i.submitter)) : data.ideas

  const impl = ideas.filter((i) => i.status === 'Implemented').length
  const inProg = ideas.filter((i) => i.status === 'In Progress').length
  const pipelineIdeas = ideas.filter((i) => PIPELINE.includes(i.status))
  const pipeline = pipelineIdeas.length
  const totalTarget = members.reduce((a, m) => a + m.target, 0)
  // Target attainment: implemented vs the members' total annual target.
  const pct = totalTarget ? Math.round((impl / totalTarget) * 100) : 0
  // Implementation rate: share of all ideas that are implemented (so a handful
  // of implemented ideas never rounds away to a misleading 0%).
  const implRate = ideas.length ? Math.round((impl / ideas.length) * 100) : 0

  // Dollar savings: total plus the split by savings type (Hard vs Soft dollar).
  const totalSavings = sumSavings(ideas)
  const hardSavings = sumSavings(ideas, 'Hard Dollar')
  const softSavings = sumSavings(ideas, 'Soft Dollar')

  // Pipeline composition by status, for the detail line under the KPI card.
  const pipelineBreakdown = PIPELINE.map((s) => ({ s, n: pipelineIdeas.filter((i) => i.status === s).length })).filter((x) => x.n)
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  // --- Aggregations -------------------------------------------------------
  const slList = useMemo(() => [...new Set(ideas.map(slOf))].sort((a, b) => a.localeCompare(b)), [ideas, memById])
  const statusList = STATUSES.filter((s) => ideas.some((i) => i.status === s))

  // On-chart count labels — show the value directly on each bar/slice (not just
  // in the hover tooltip). Zeros are blanked to avoid clutter.
  const barDataLabels = {
    enabled: true,
    formatter: (v) => (v ? v : ''),
    style: { fontSize: '10px', fontWeight: 700, colors: ['#fff'] },
    dropShadow: { enabled: true, top: 1, left: 0, blur: 1, opacity: 0.45 },
  }
  // For donut slices the count is the series value at that index.
  const sliceCount = { enabled: true, formatter: (v, opts) => opts.w.config.series[opts.seriesIndex], style: { fontSize: '11px', fontWeight: 700 }, dropShadow: { enabled: true, top: 1, left: 0, blur: 2, opacity: 0.5 } }

  const statusDonut = {
    series: statusList.map((s) => ideas.filter((i) => i.status === s).length),
    options: { ...AX, chart: { ...AX.chart, id: 'd-status' }, labels: statusList, colors: statusList.map((s) => STATUS_COL[s] || '#888'), legend: { ...AX.legend, position: 'bottom' }, dataLabels: sliceCount, plotOptions: { pie: { donut: { size: '62%' } } }, stroke: { width: 0 } },
  }

  const slDonut = {
    series: slList.map((sl) => ideas.filter((i) => slOf(i) === sl).length),
    options: { ...AX, chart: { ...AX.chart, id: 'd-sl' }, labels: slList, colors: slList.map((_, i) => PAL[i % PAL.length]), legend: { ...AX.legend, position: 'bottom' }, dataLabels: sliceCount, plotOptions: { pie: { donut: { size: '62%' } } }, stroke: { width: 0 } },
  }

  // Drive the gauge with the implementation rate (% of all ideas implemented)
  // so it stays meaningful — target attainment vs the full annual target reads
  // ~0% for most of the year and is shown as context in the caption instead.
  const gaugeCol = implRate >= 80 ? '#22c55e' : implRate >= 50 ? '#f59e0b' : '#3b82f6'
  const gauge = {
    series: [Math.min(100, implRate)],
    options: {
      ...AX, chart: { ...AX.chart, id: 'd-gauge' }, colors: [gaugeCol], labels: ['Implemented'],
      plotOptions: { radialBar: { hollow: { size: '56%' }, track: { background: 'rgba(255,255,255,0.06)' }, dataLabels: { name: { color: '#8899b0', fontSize: '12px', offsetY: 22 }, value: { color: '#e2e8f4', fontSize: '28px', fontWeight: 700, offsetY: -12, formatter: (v) => Math.round(v) + '%' } } } },
    },
  }

  // Status composition stacked per Service Line — the "overall status" view.
  const statusBySL = {
    series: statusList.map((st) => ({ name: st, data: slList.map((sl) => ideas.filter((i) => slOf(i) === sl && i.status === st).length) })),
    options: merge({ chart: { id: 'd-status-sl', stacked: true }, colors: statusList.map((s) => STATUS_COL[s] || '#888'), plotOptions: { bar: { columnWidth: '55%', borderRadius: 4 } }, dataLabels: barDataLabels, xaxis: { categories: slList }, yaxis: { title: { text: 'Ideas', style: { color: '#5e6a82', fontWeight: 500 } } }, legend: { ...AX.legend, position: 'top' } }),
  }

  // Target vs Implemented per Service Line.
  const slStats = slList.map((sl) => ({
    tgt: members.filter((m) => m.sl === sl).reduce((a, m) => a + m.target, 0),
    impl: ideas.filter((i) => slOf(i) === sl && i.status === 'Implemented').length,
  }))
  const targetSL = {
    series: [{ name: 'Target', data: slStats.map((s) => s.tgt) }, { name: 'Implemented', data: slStats.map((s) => s.impl) }],
    options: merge({ chart: { id: 'd-target-sl' }, colors: ['#94a3b8', '#22c55e'], plotOptions: { bar: { columnWidth: '55%', borderRadius: 4 } }, dataLabels: barDataLabels, xaxis: { categories: slList }, legend: { ...AX.legend, position: 'top' } }),
  }

  // Ideas by POD (top teams) — total vs implemented.
  const podStats = pods.filter((p) => !slF || p.sl === slF).map((p) => {
    const pm = members.filter((m) => m.pod === p.code).map((m) => m.id)
    return { name: p.name, c: ideas.filter((i) => pm.includes(i.submitter)).length, im: ideas.filter((i) => i.status === 'Implemented' && pm.includes(i.submitter)).length }
  }).filter((x) => x.c > 0).sort((a, b) => b.c - a.c).slice(0, 12)
  const podBarHeight = Math.max(240, podStats.length * 34 + 60)
  const podBar = {
    series: [{ name: 'Ideas', data: podStats.map((s) => s.c) }, { name: 'Implemented', data: podStats.map((s) => s.im) }],
    options: merge({ chart: { id: 'd-pod' }, colors: ['#3b82f6', '#22c55e'], plotOptions: { bar: { horizontal: true, borderRadius: 3, barHeight: '70%' } }, dataLabels: { ...barDataLabels, offsetX: 0 }, xaxis: { categories: podStats.map((s) => s.name) }, legend: { ...AX.legend, position: 'top' } }),
  }

  // Service Line summary table (members / ideas / implemented / attainment).
  const slSummary = [...new Set([...slList, ...members.map((m) => m.sl).filter(Boolean)])]
    .sort((a, b) => a.localeCompare(b))
    .map((sl) => {
      const mem = members.filter((m) => m.sl === sl)
      const slIdeas = ideas.filter((i) => slOf(i) === sl)
      const im = slIdeas.filter((i) => i.status === 'Implemented').length
      const tgt = mem.reduce((a, m) => a + m.target, 0)
      return { sl, members: mem.length, ideas: slIdeas.length, impl: im, tgt, pct: tgt ? Math.round((im / tgt) * 100) : 0 }
    })

  return (
    <>
      <div className="tb"><h2>Dashboard</h2>
        <div className="tb-r">
          <select style={{ width: 'auto' }} value={slF} onChange={(e) => { setSlF(e.target.value); setPodF('') }}>
            <option value="">All Service Lines</option>
            {serviceLines.map((sl) => <option key={sl} value={sl}>{sl}</option>)}
          </select>
          <select style={{ width: 'auto' }} value={podF} onChange={(e) => setPodF(e.target.value)}>
            <option value="">All PODs</option>
            {pods.filter((p) => !slF || p.sl === slF).map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
          </select>
          <button className="btn btn-p btn-sm" disabled={exporting} title="Download overall + per-POD status (with charts) as Excel" onClick={downloadExcel}>{exporting ? 'Generating…' : '⤓ Excel'}</button>
          <span style={{ fontSize: 11, color: 'var(--mu)' }}>{today}</span>
        </div>
      </div>
      <div className="con">
        {/* KPI summary */}
        <div className="g5" style={{ marginBottom: 14 }}>
          <div className="mc"><div className="mc-l">Total Ideas</div><div className="mc-v" style={{ color: 'var(--blue)' }}>{ideas.length}</div><div className="mc-s">{members.length} members{slF ? ` · ${slF}` : `, ${serviceLines.length} service line(s)`}</div></div>
          <div className="mc"><div className="mc-l">Implemented</div><div className="mc-v" style={{ color: 'var(--green)' }}>{impl}</div><div className="mc-s">{implRate}% of all ideas · {pct}% of {totalTarget} target</div><div className="mc-pb"><div className="mc-pf" style={{ width: Math.min(100, implRate) + '%', background: 'var(--green)' }} /></div></div>
          <div className="mc"><div className="mc-l">In Progress</div><div className="mc-v" style={{ color: 'var(--blue)' }}>{inProg}</div><div className="mc-s">Active now</div></div>
          <div className="mc"><div className="mc-l">Pipeline</div><div className="mc-v" style={{ color: 'var(--purple)' }}>{pipeline}</div><div className="mc-s">{pipelineBreakdown.length ? pipelineBreakdown.map((x) => `${x.s} ${x.n}`).join(' · ') : 'Proposed · POC · New · Ideation'}</div></div>
          <div className="mc"><div className="mc-l">Total Savings</div><div className="mc-v" style={{ color: 'var(--green)' }}>{fmtUSD(totalSavings)}</div><div className="mc-s">{fmtUSD(hardSavings)} hard · {fmtUSD(softSavings)} soft</div></div>
        </div>

        {/* Distribution donuts + attainment gauge */}
        <div className="g3" style={{ marginBottom: 14 }}>
          <Card title="Ideas by Status" height={260} chartId="d-status" note={ideas.length ? null : 'No ideas yet.'}>
            <Chart options={statusDonut.options} series={statusDonut.series} type="donut" height="100%" />
          </Card>
          <Card title="Ideas by Service Line" height={260} chartId="d-sl" note={ideas.length ? null : 'No ideas yet.'}>
            <Chart options={slDonut.options} series={slDonut.series} type="donut" height="100%" />
          </Card>
          <Card title="Implementation Rate" height={260} chartId="d-gauge">
            <Chart options={gauge.options} series={gauge.series} type="radialBar" height="100%" />
            <div style={{ textAlign: 'center', marginTop: -10, fontSize: 11, color: 'var(--mu)' }}>{impl} of {ideas.length} ideas implemented · {pct}% of {totalTarget} annual target</div>
          </Card>
        </div>

        {/* Status composition by Service Line */}
        <div style={{ marginBottom: 14 }}>
          <Card title="Idea Status by Service Line" height={340} chartId="d-status-sl" note={slList.length ? null : 'No ideas yet.'}>
            <Chart options={statusBySL.options} series={statusBySL.series} type="bar" height="100%" />
          </Card>
        </div>

        {/* Target vs implemented + POD breakdown */}
        <div className="g2" style={{ marginBottom: 14 }}>
          <Card title="Target vs Implemented by Service Line" height={320} chartId="d-target-sl" note={slList.length ? null : 'No data yet.'}>
            <Chart options={targetSL.options} series={targetSL.series} type="bar" height="100%" />
          </Card>
          <Card title="Ideas by POD (Top teams)" height={320} chartId="d-pod" note={podStats.length ? null : 'No POD data yet.'}>
            <div style={{ height: '100%', overflowY: 'auto', overflowX: 'hidden' }}>
              <Chart options={podBar.options} series={podBar.series} type="bar" height={podBarHeight} />
            </div>
          </Card>
        </div>

        {/* Service Line summary + recent ideas */}
        <div className="g2">
          <div className="card">
            <div className="sh" style={{ marginBottom: 12 }}>Service Line Summary</div>
            {!slSummary.length ? <div style={{ color: 'var(--mu)', fontSize: 12 }}>No data.</div> : (
              <div className="tw"><table>
                <thead><tr><th>Service Line</th><th style={{ textAlign: 'right' }}>Members</th><th style={{ textAlign: 'right' }}>Ideas</th><th style={{ textAlign: 'right' }}>Impl.</th><th style={{ minWidth: 120 }}>Attainment</th></tr></thead>
                <tbody>
                  {slSummary.map((r) => (
                    <tr key={r.sl}>
                      <td style={{ fontSize: 12.5, fontWeight: 500 }}>{r.sl}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 12 }}>{r.members}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 12 }}>{r.ideas}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--green)' }}>{r.impl}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div className="pbar" style={{ flex: 1 }}><div className="pbar-f" style={{ width: Math.min(100, r.pct) + '%', background: r.pct >= 80 ? 'var(--green)' : r.pct >= 50 ? 'var(--amber)' : 'var(--blue)' }} /></div>
                          <span style={{ fontSize: 11, color: 'var(--mu2)', minWidth: 30, textAlign: 'right' }}>{r.pct}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            )}
          </div>

          <div className="card">
            <div className="sh" style={{ marginBottom: 12 }}>Recent Ideas</div>
            {ideas.slice(0, 7).map((i) => (
              <div key={i.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--b1)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{i.title || 'Untitled'}</div>
                  <div style={{ fontSize: 11, color: 'var(--mu)' }}>{memberName(allMembers, i.submitter)} · {slOf(i)}</div>
                </div>
                <StatusBadge status={i.status} />
              </div>
            ))}
            {!ideas.length && <div style={{ color: 'var(--mu)', fontSize: 12 }}>No ideas yet.</div>}
            <div style={{ marginTop: 10, textAlign: 'center' }}><button className="btn btn-sm" onClick={() => onNav('ideas')}>View all ideas</button></div>
          </div>
        </div>
      </div>
    </>
  )
}
