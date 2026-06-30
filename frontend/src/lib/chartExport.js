// Export ApexCharts to high-resolution PNG for slides / reports.
import ApexCharts from 'apexcharts'

export function slugify(s) {
  return String(s || 'chart').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'chart'
}

function triggerDownload(uri, filename) {
  const a = document.createElement('a')
  a.href = uri
  a.download = filename + '.png'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

// Export a single chart (by its chart.id) at 2x scale.
export function exportChartPNG(chartId, filename) {
  return Promise.resolve(ApexCharts.exec(chartId, 'dataURI', { scale: 2 }))
    .then((res) => {
      const uri = res && res.imgURI
      if (uri) triggerDownload(uri, filename || chartId)
    })
    .catch(() => { /* chart not ready / unknown id */ })
}

// Export several charts in sequence (small gap so browsers allow the batch).
export async function exportChartsPNG(charts) {
  for (const c of charts) {
    await exportChartPNG(c.id, c.filename)
    await new Promise((r) => setTimeout(r, 350))
  }
}
