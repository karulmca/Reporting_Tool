// Shared ApexCharts dark-theme base used by every analytics chart.
export const AX = {
  chart: { background: 'transparent', toolbar: { show: false }, fontFamily: 'Inter, sans-serif', foreColor: '#8899b0', animations: { speed: 400 } },
  theme: { mode: 'dark' },
  grid: { borderColor: 'rgba(255,255,255,0.06)', strokeDashArray: 3 },
  tooltip: { theme: 'dark' },
  dataLabels: { enabled: false },
  legend: { labels: { colors: '#8899b0' }, fontSize: '11px', markers: { width: 9, height: 9 } },
  states: { active: { filter: { type: 'none' } } },
}

// Merge chart-specific options over the base (deep-merging the chart key).
export const merge = (extra) => ({ ...AX, ...extra, chart: { ...AX.chart, ...(extra.chart || {}) } })

// On-chart value labels — show the count/value directly on each bar (not just
// in the hover tooltip). Zeros are blanked to avoid clutter on stacked/grouped
// bars and empty categories.
export const barCountLabels = {
  enabled: true,
  formatter: (v) => (v ? v : ''),
  style: { fontSize: '10px', fontWeight: 700, colors: ['#fff'] },
  dropShadow: { enabled: true, top: 1, left: 0, blur: 1, opacity: 0.45 },
}

// On-chart labels for donut/pie slices — the slice's series value is the count.
export const sliceCountLabels = {
  enabled: true,
  formatter: (v, opts) => opts.w.config.series[opts.seriesIndex],
  style: { fontSize: '11px', fontWeight: 700 },
  dropShadow: { enabled: true, top: 1, left: 0, blur: 2, opacity: 0.5 },
}
