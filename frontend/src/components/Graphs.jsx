import React, { useState } from 'react'
import Chart from 'react-apexcharts'
import { useApp } from '../store'
import PodFilter from './PodFilter'
import { implCount, progCount, STATUS_COL, PAL } from '../lib/helpers'
import { kpis, velocitySeries, rollingAverage, burnUp } from '../lib/analytics'
import { AX, merge, barCountLabels, sliceCountLabels } from '../lib/chartTheme'
import { Card, Delta, KpiCard } from './ChartKit'
import { exportChartsPNG } from '../lib/chartExport'
import { captureCharts, exportReportPDF, exportReportExcel } from '../lib/reportExport'

const ALL_CHARTS = [
  { id: 'g-velocity', filename: 'sprint-velocity' },
  { id: 'g-burn', filename: 'burn-up-forecast' },
  { id: 'g-gauge', filename: 'idea-target' },
  { id: 'g-status', filename: 'ideas-by-status' },
  { id: 'g-pod', filename: 'ideas-by-pod' },
  { id: 'g-memberprog', filename: 'member-progress' },
  { id: 'g-targetactual', filename: 'target-vs-actual' },
]

export default function Graphs() {
  const { data, toast } = useApp()
  const [podF, setPodF] = useState('')
  const [exporting, setExporting] = useState(false)
  const allMembers = data.members

  async function downloadReport(kind) {
    setExporting(true)
    try {
      const charts = await captureCharts()
      if (kind === 'pdf') { exportReportPDF(data, charts); toast('Opening printable report…', 'i') }
      else { await exportReportExcel(data, charts); toast('Excel report downloaded', 's') }
    } catch (e) {
      toast('Report failed: ' + e.message, 'e')
    } finally {
      setExporting(false)
    }
  }
  const members = podF ? allMembers.filter((m) => m.pod === podF) : allMembers
  const ideas = podF ? data.ideas.filter((i) => members.some((m) => m.id === i.submitter)) : data.ideas
  const sprints = podF ? data.sprints.filter((s) => members.some((m) => m.id === s.member)) : data.sprints
  const pods = data.pods

  const k = kpis(members, ideas, sprints)
  const v = velocitySeries(sprints)
  const bu = burnUp(sprints)
  const hasSprints = v.months.length > 0

  const rateCol = k.deliveryRate >= 80 ? 'var(--green)' : k.deliveryRate >= 50 ? 'var(--amber)' : 'var(--red)'
  const targetCol = k.targetPct >= 80 ? 'var(--green)' : k.targetPct >= 50 ? 'var(--amber)' : 'var(--red)'
  const fcColor = k.forecast.onTrack ? '#22c55e' : '#f59e0b'

  // --- Velocity (committed/completed columns + rolling-avg line) ----------
  const velocity = {
    series: [
      { name: 'Committed', type: 'column', data: v.committed },
      { name: 'Completed', type: 'column', data: v.completed },
      { name: 'Rolling Avg (3)', type: 'line', data: rollingAverage(v.completed, 3) },
    ],
    options: merge({
      chart: { id: 'g-velocity' },
      colors: ['#3b82f6', '#22c55e', '#f59e0b'],
      stroke: { width: [0, 0, 3], curve: 'smooth' },
      markers: { size: [0, 0, 4] },
      dataLabels: { ...barCountLabels, enabledOnSeries: [0, 1] },
      plotOptions: { bar: { columnWidth: '55%', borderRadius: 4 } },
      xaxis: { categories: v.months },
      yaxis: { title: { text: 'Story Points', style: { color: '#5e6a82', fontWeight: 500 } } },
      legend: { ...AX.legend, position: 'top' },
    }),
  }

  // --- Burn-up + projection ----------------------------------------------
  const burn = {
    series: [
      { name: 'Committed (plan)', data: bu.committed },
      { name: 'Completed (actual)', data: bu.completed },
      { name: 'Projected', data: bu.projected },
    ],
    options: merge({
      chart: { id: 'g-burn' },
      colors: ['#94a3b8', '#22c55e', '#8b5cf6'],
      stroke: { width: [2, 3, 2], dashArray: [0, 0, 6], curve: 'smooth' },
      fill: { type: ['solid', 'gradient', 'solid'], opacity: [0, 0.15, 0] },
      markers: { size: 0, hover: { size: 4 } },
      xaxis: { categories: bu.categories },
      yaxis: { title: { text: 'Cumulative SP', style: { color: '#5e6a82', fontWeight: 500 } } },
      legend: { ...AX.legend, position: 'top' },
      annotations: { points: [] },
    }),
  }

  // --- Annual idea-target gauge ------------------------------------------
  const gauge = {
    series: [k.targetPct],
    options: {
      ...AX,
      chart: { ...AX.chart, id: 'g-gauge' },
      colors: [fcColor],
      labels: ['To Target'],
      plotOptions: {
        radialBar: {
          hollow: { size: '58%' },
          track: { background: 'rgba(255,255,255,0.06)' },
          dataLabels: {
            name: { color: '#8899b0', fontSize: '12px', offsetY: 22 },
            value: { color: '#e2e8f4', fontSize: '30px', fontWeight: 700, offsetY: -16, formatter: (val) => Math.round(val) + '%' },
          },
        },
      },
    },
  }

  // --- Ideas by status (donut) -------------------------------------------
  const statuses = [...new Set(ideas.map((i) => i.status))]
  const statusDonut = {
    series: statuses.map((s) => ideas.filter((i) => i.status === s).length),
    options: { ...AX, chart: { ...AX.chart, id: 'g-status' }, labels: statuses, colors: statuses.map((s) => STATUS_COL[s] || '#888'), legend: { ...AX.legend, position: 'bottom' }, dataLabels: sliceCountLabels, plotOptions: { pie: { donut: { size: '62%' } } }, stroke: { width: 0 } },
  }

  // --- Ideas by POD (donut) ----------------------------------------------
  const podDonut = {
    series: pods.map((p) => { const mids = allMembers.filter((m) => m.pod === p.code).map((m) => m.id); return ideas.filter((i) => mids.includes(i.submitter)).length }),
    options: { ...AX, chart: { ...AX.chart, id: 'g-pod' }, labels: pods.map((p) => p.code), colors: pods.map((p, i) => p.color || PAL[i % PAL.length]), legend: { ...AX.legend, position: 'bottom' }, dataLabels: sliceCountLabels, plotOptions: { pie: { donut: { size: '62%' } } }, stroke: { width: 0 } },
  }

  // All (filtered) members ranked by completion % (highest first). ApexCharts
  // horizontal bars render the first category at the top, so the max is on top.
  const ranked = members.map((m) => {
    const done = implCount(ideas, m.id)
    return { m, done, prog: progCount(ideas, m.id), submitted: ideas.filter((i) => i.submitter === m.id).length, pp: m.target ? Math.min(100, Math.round((done / m.target) * 100)) : 0 }
  }).sort((a, b) => b.submitted - a.submitted || b.done - a.done || a.m.name.localeCompare(b.m.name))

  // Member-progress chart height grows with member count so every member stays
  // legible; the card itself is capped and scrolls vertically when there are
  // many members (e.g. the "All PODs" selection).
  const progHeight = Math.max(280, ranked.length * 30 + 60)
  const progView = Math.min(progHeight, 460)
  const taHeight = 320

  // --- Member progress (horizontal) --------------------------------------
  const memberProg = {
    series: [
      { name: 'Submitted', data: ranked.map((r) => r.submitted) },
      { name: 'Implemented', data: ranked.map((r) => r.done) },
      { name: 'In Progress', data: ranked.map((r) => r.prog) },
      { name: 'Target', data: ranked.map((r) => r.m.target) },
    ],
    options: merge({
      chart: { id: 'g-memberprog' },
      colors: ['#8b5cf6', '#22c55e', '#3b82f6', '#94a3b8'],
      dataLabels: barCountLabels,
      plotOptions: { bar: { horizontal: true, borderRadius: 3, barHeight: '70%' } },
      xaxis: { categories: ranked.map((r) => `${r.m.name} · ${r.pp}%`) },
      legend: { ...AX.legend, position: 'top' },
    }),
  }

  // --- Target vs actual, aggregated per POD (team-level attainment) -------
  const podRollup = pods.map((p) => {
    const podMembers = members.filter((m) => m.pod === p.code)
    const mids = podMembers.map((m) => m.id)
    const target = podMembers.reduce((a, m) => a + m.target, 0)
    const actual = ideas.filter((i) => i.status === 'Implemented' && mids.includes(i.submitter)).length
    return { code: p.code, target, actual, pct: target ? actual / target : 0 }
  }).filter((r) => r.target > 0 || r.actual > 0).sort((a, b) => b.pct - a.pct || b.actual - a.actual)
  const targetActual = {
    series: [
      { name: 'Target', data: podRollup.map((r) => r.target) },
      { name: 'Actual', data: podRollup.map((r) => r.actual) },
    ],
    options: merge({
      chart: { id: 'g-targetactual' },
      colors: ['#94a3b8', '#3b82f6'],
      dataLabels: barCountLabels,
      plotOptions: { bar: { columnWidth: '55%', borderRadius: 4 } },
      xaxis: { categories: podRollup.map((r) => r.code) },
      legend: { ...AX.legend, position: 'top' },
    }),
  }

  return (
    <>
      <div className="tb"><h2>Graphs &amp; Progress</h2>
        <div className="tb-r">
          <PodFilter value={podF} onChange={setPodF} />
          <button className="btn btn-sm btn-g" title="Download all charts as PNG" onClick={() => exportChartsPNG(ALL_CHARTS)}>&#10515; All Charts</button>
          <button className="btn btn-sm btn-p" disabled={exporting} title="Printable PDF report with charts" onClick={() => downloadReport('pdf')}>{exporting ? '…' : '⤓ PDF Report'}</button>
          <button className="btn btn-sm" disabled={exporting} title="Excel report with charts embedded" onClick={() => downloadReport('excel')}>{exporting ? '…' : '⤓ Excel + Charts'}</button>
        </div>
      </div>
      <div className="con">
        {/* KPI summary cards */}
        <div className="g4" style={{ marginBottom: 14 }}>
          <div className="mc">
            <div className="mc-l">Delivery Rate</div>
            <div className="mc-v" style={{ color: rateCol }}>{k.deliveryRate}%</div>
            <div className="mc-s"><Delta value={k.deliveryDelta} unit="pp" /></div>
            <div className="mc-pb"><div className="mc-pf" style={{ width: k.deliveryRate + '%', background: rateCol }} /></div>
          </div>
          <div className="mc">
            <div className="mc-l">Velocity {k.latestSprint ? `· ${k.latestSprint}` : ''}</div>
            <div className="mc-v" style={{ color: 'var(--blue)' }}>{k.latestVelocity}</div>
            <div className="mc-s"><Delta value={k.velocityDelta} unit=" SP" /></div>
          </div>
          <KpiCard label="Avg Velocity" value={k.avgVelocity} valueColor="var(--purple)" sub="SP / sprint (mean)" />
          <KpiCard label="Idea Target" value={`${k.implemented}/${k.target}`} valueColor={targetCol} sub={`${k.gap} to go · ${k.targetPct}%`} pct={k.targetPct} pctColor={targetCol} />
        </div>

        {/* Velocity & forecasting */}
        <div className="g2" style={{ marginBottom: 12 }}>
          <Card title="Sprint Velocity — Committed vs Completed" height={280} chartId="g-velocity" note={hasSprints ? null : 'No sprint data yet.'}>
            <Chart options={velocity.options} series={velocity.series} type="line" height="100%" />
          </Card>
          <Card title="Burn-up & Forecast (cumulative SP)" height={280} chartId="g-burn" note={hasSprints ? null : 'No sprint data yet.'}>
            <Chart options={burn.options} series={burn.series} type="line" height="100%" />
          </Card>
        </div>

        <div className="g3" style={{ marginBottom: 12 }}>
          <Card title="Annual Idea Target" height={250} chartId="g-gauge">
            <Chart options={gauge.options} series={gauge.series} type="radialBar" height="100%" />
            <div style={{ textAlign: 'center', marginTop: -8 }}>
              <span className="badge" style={{ background: fcColor + '22', color: fcColor }}>{k.forecast.label}</span>
              <div style={{ fontSize: 11, color: 'var(--mu)', marginTop: 6 }}>~{k.forecast.ratePerSprint} ideas/sprint implemented</div>
            </div>
          </Card>
          <Card title="Ideas by Status" height={250} chartId="g-status" note={ideas.length ? null : 'No ideas yet.'}>
            <Chart options={statusDonut.options} series={statusDonut.series} type="donut" height="100%" />
          </Card>
          <Card title="Ideas by POD" height={250} chartId="g-pod" note={ideas.length ? null : 'No ideas yet.'}>
            <Chart options={podDonut.options} series={podDonut.series} type="donut" height="100%" />
          </Card>
        </div>

        <div className="g2">
          <Card title="Member Progress (Implemented vs Target)" height={progView} chartId="g-memberprog" note={members.length ? null : 'No members yet.'}>
            <div style={{ height: '100%', overflowY: 'auto', overflowX: 'hidden' }}>
              <Chart options={memberProg.options} series={memberProg.series} type="bar" height={progHeight} />
            </div>
          </Card>
          <Card title="Target vs Actual by POD" height={taHeight} chartId="g-targetactual" note={podRollup.length ? null : 'No POD data yet.'}>
            <Chart options={targetActual.options} series={targetActual.series} type="bar" height="100%" />
          </Card>
        </div>
      </div>
    </>
  )
}
