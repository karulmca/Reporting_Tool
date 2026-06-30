import React, { useState, useEffect } from 'react'
import Chart from 'react-apexcharts'
import { useApp } from '../store'
import PodFilter from './PodFilter'
import { Avatar, StatusBadge, PodBadge, Empty } from './ui'
import { Card, Delta, KpiCard } from './ChartKit'
import { AX, merge, barCountLabels, sliceCountLabels } from '../lib/chartTheme'
import { kpis, velocitySeries, rollingAverage, burnUp } from '../lib/analytics'
import { implCount, progCount, podColor, STATUS_COL, resolveContributorNames } from '../lib/helpers'

export default function MemberAnalytics() {
  const { data } = useApp()
  const { members, ideas, sprints, pods } = data
  const ST_COL = Object.fromEntries((data.training.statusOptions || []).map((o) => [o.label, o.color]))
  const [podF, setPodF] = useState('')
  const [selId, setSelId] = useState('')

  const pool = (podF ? members.filter((m) => m.pod === podF) : members).slice().sort((a, b) => a.name.localeCompare(b.name))

  // Keep the selection valid as data / filter changes.
  useEffect(() => {
    if (!pool.length) { if (selId) setSelId(''); return }
    if (!pool.some((m) => m.id === selId)) setSelId(pool[0].id)
  }, [pool.map((m) => m.id).join('|')]) // eslint-disable-line react-hooks/exhaustive-deps

  const member = members.find((m) => m.id === selId)

  if (!members.length) {
    return (<><div className="tb"><h2>Member Progress</h2></div><div className="con"><Empty>No members yet. Add members first.</Empty></div></>)
  }

  const myIdeas = member ? ideas.filter((i) => i.submitter === member.id) : []
  const mySprints = member ? sprints.filter((s) => s.member === member.id) : []
  const contributed = member ? ideas.filter((i) => i.submitter !== member.id && resolveContributorNames(members, i.contributors).some((c) => c.member && c.member.id === member.id)) : []
  const courses = data.training.courses || []
  const myTraining = member ? (data.training.status[member.id] || {}) : {}

  const k = kpis(member ? [member] : [], myIdeas, mySprints)
  const v = velocitySeries(mySprints)
  const bu = burnUp(mySprints)
  const hasSprints = v.months.length > 0
  const targetCol = k.targetPct >= 80 ? 'var(--green)' : k.targetPct >= 50 ? 'var(--amber)' : 'var(--red)'
  const rateCol = k.deliveryRate >= 80 ? 'var(--green)' : k.deliveryRate >= 50 ? 'var(--amber)' : 'var(--red)'
  const fcColor = k.forecast.onTrack ? '#22c55e' : '#f59e0b'

  const velocity = {
    series: [
      { name: 'Committed', type: 'column', data: v.committed },
      { name: 'Completed', type: 'column', data: v.completed },
      { name: 'Rolling Avg (3)', type: 'line', data: rollingAverage(v.completed, 3) },
    ],
    options: merge({
      chart: { id: 'm-velocity' },
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
  const burn = {
    series: [
      { name: 'Committed (plan)', data: bu.committed },
      { name: 'Completed (actual)', data: bu.completed },
      { name: 'Projected', data: bu.projected },
    ],
    options: merge({
      chart: { id: 'm-burn' },
      colors: ['#5e6a82', '#22c55e', '#8b5cf6'],
      stroke: { width: [2, 3, 2], dashArray: [0, 0, 6], curve: 'smooth' },
      fill: { type: ['solid', 'gradient', 'solid'], opacity: [0, 0.15, 0] },
      markers: { size: 0, hover: { size: 4 } },
      xaxis: { categories: bu.categories },
      yaxis: { title: { text: 'Cumulative SP', style: { color: '#5e6a82', fontWeight: 500 } } },
      legend: { ...AX.legend, position: 'top' },
    }),
  }
  const statuses = [...new Set(myIdeas.map((i) => i.status))]
  const statusDonut = {
    series: statuses.map((s) => myIdeas.filter((i) => i.status === s).length),
    options: { ...AX, chart: { ...AX.chart, id: 'm-status' }, labels: statuses, colors: statuses.map((s) => STATUS_COL[s] || '#888'), legend: { ...AX.legend, position: 'bottom' }, dataLabels: sliceCountLabels, plotOptions: { pie: { donut: { size: '62%' } } }, stroke: { width: 0 } },
  }
  const gauge = {
    series: [k.targetPct],
    options: {
      ...AX, chart: { ...AX.chart, id: 'm-gauge' }, colors: [fcColor], labels: ['To Target'],
      plotOptions: { radialBar: { hollow: { size: '58%' }, track: { background: 'rgba(255,255,255,0.06)' }, dataLabels: { name: { color: '#8899b0', fontSize: '12px', offsetY: 22 }, value: { color: '#e2e8f4', fontSize: '30px', fontWeight: 700, offsetY: -16, formatter: (val) => Math.round(val) + '%' } } } },
    },
  }

  return (
    <>
      <div className="tb"><h2>Member Progress</h2>
        <div className="tb-r">
          <PodFilter value={podF} onChange={setPodF} />
          <select style={{ width: 'auto', minWidth: 200 }} value={selId} onChange={(e) => setSelId(e.target.value)}>
            {pool.map((m) => <option key={m.id} value={m.id}>{m.name} · {m.pod}</option>)}
          </select>
        </div>
      </div>
      <div className="con">
        {!member ? <Empty>No members found for this POD.</Empty> : (
          <>
            {/* Member header */}
            <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
              <Avatar members={members} name={member.name} size={48} fontSize={16} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 17, fontWeight: 700 }}>{member.name}</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4, fontSize: 12, color: 'var(--mu)' }}>
                  <PodBadge pods={pods} code={member.pod} podColor={podColor} />
                  <span>ID {member.id}</span><span>·</span><span>{member.sl}</span><span>·</span><span>Target {member.target} ideas/yr</span>
                </div>
              </div>
              <span className="badge" style={{ background: fcColor + '22', color: fcColor }}>{k.forecast.label}</span>
            </div>

            {/* KPI cards */}
            <div className="g4" style={{ marginBottom: 14 }}>
              <KpiCard label="Implemented" value={`${k.implemented}/${k.target}`} valueColor={targetCol} sub={`${k.targetPct}% of target`} pct={k.targetPct} pctColor={targetCol} />
              <KpiCard label="In Progress" value={progCount(ideas, member.id)} valueColor="var(--blue)" sub="active ideas" />
              <KpiCard label="Gap to Target" value={k.gap} valueColor={k.gap > 6 ? 'var(--red)' : k.gap > 0 ? 'var(--amber)' : 'var(--green)'} sub="ideas still needed" />
              <div className="mc">
                <div className="mc-l">Velocity {k.latestSprint ? `· ${k.latestSprint}` : ''}</div>
                <div className="mc-v" style={{ color: 'var(--blue)' }}>{k.latestVelocity}</div>
                <div className="mc-s"><Delta value={k.velocityDelta} unit=" SP" /></div>
              </div>
            </div>

            {/* Gauge + velocity */}
            <div className="g2" style={{ marginBottom: 12 }}>
              <Card title="Idea Target Progress" height={250} chartId="m-gauge">
                <Chart options={gauge.options} series={gauge.series} type="radialBar" height="100%" />
                <div style={{ textAlign: 'center', marginTop: -8, fontSize: 11, color: 'var(--mu)' }}>Delivery rate <span style={{ color: rateCol, fontWeight: 600 }}>{k.deliveryRate}%</span> · ~{k.forecast.ratePerSprint} ideas/sprint</div>
              </Card>
              <Card title="Sprint Velocity — Committed vs Completed" height={250} chartId="m-velocity" note={hasSprints ? null : 'No sprint data for this member yet.'}>
                <Chart options={velocity.options} series={velocity.series} type="line" height="100%" />
              </Card>
            </div>

            {/* Status + burn-up */}
            <div className="g2" style={{ marginBottom: 12 }}>
              <Card title="My Ideas by Status" height={250} chartId="m-status" note={myIdeas.length ? null : 'No ideas submitted yet.'}>
                <Chart options={statusDonut.options} series={statusDonut.series} type="donut" height="100%" />
              </Card>
              <Card title="Burn-up & Forecast (cumulative SP)" height={250} chartId="m-burn" note={hasSprints ? null : 'No sprint data for this member yet.'}>
                <Chart options={burn.options} series={burn.series} type="line" height="100%" />
              </Card>
            </div>

            {/* Training */}
            <div className="card" style={{ marginBottom: 12 }}>
              <div className="sh">Training</div>
              {!courses.length ? <div style={{ color: 'var(--mu)', fontSize: 12 }}>No courses defined.</div> : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {courses.map((c) => {
                    const st = myTraining[c.id] || ''
                    const col = ST_COL[st] || 'var(--mu)'
                    return (
                      <div key={c.id} style={{ border: '1px solid var(--b1)', borderRadius: 8, padding: '8px 12px', minWidth: 150 }}>
                        <div style={{ fontSize: 11, color: 'var(--mu2)', fontFamily: 'var(--mono)' }}>{c.id}</div>
                        <div style={{ fontSize: 11, color: 'var(--mu)', marginBottom: 4 }}>{c.name}</div>
                        <span className="badge" style={{ background: col + '22', color: col }}>{st || 'Not set'}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Ideas + contributions */}
            <div className="g2">
              <Card title={`Submitted Ideas (${myIdeas.length})`} height={undefined} note={myIdeas.length ? null : 'None yet.'}>
                {myIdeas.length > 0 && (
                  <div className="tw"><table>
                    <thead><tr><th>Title</th><th>Status</th></tr></thead>
                    <tbody>{myIdeas.map((i) => <tr key={i.id}><td>{i.title || '-'}</td><td><StatusBadge status={i.status} /></td></tr>)}</tbody>
                  </table></div>
                )}
              </Card>
              <Card title={`Contributions (${contributed.length})`} height={undefined} note={contributed.length ? null : 'No contributions to others’ ideas.'}>
                {contributed.length > 0 && (
                  <div className="tw"><table>
                    <thead><tr><th>Title</th><th>Submitter</th><th>Status</th></tr></thead>
                    <tbody>{contributed.map((i) => {
                      const sub = members.find((m) => m.id === i.submitter)
                      return <tr key={i.id}><td>{i.title || '-'}</td><td style={{ color: 'var(--mu2)' }}>{sub ? sub.name : i.submitter}</td><td><StatusBadge status={i.status} /></td></tr>
                    })}</tbody>
                  </table></div>
                )}
              </Card>
            </div>
          </>
        )}
      </div>
    </>
  )
}
