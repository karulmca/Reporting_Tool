import React, { useState, useEffect, useCallback } from 'react'
import { useApp } from '../store'
import { Empty } from './ui'

const A_COL = { CREATE: 'var(--green)', UPDATE: 'var(--blue)', DELETE: 'var(--red)', UPSERT: 'var(--amber)' }

export default function Audit() {
  const { api } = useApp()
  const [rows, setRows] = useState(null)
  const [err, setErr] = useState(false)

  const load = useCallback(async () => {
    setErr(false)
    try { setRows(await api.getAudit()) } catch { setErr(true) }
  }, [api])

  useEffect(() => { load() }, [load])

  return (
    <>
      <div className="tb"><h2>Audit Log</h2><div className="tb-r"><button className="btn btn-sm" onClick={load}>&#8635; Refresh</button></div></div>
      <div className="con">
        {err ? <Empty>Could not load audit log</Empty>
          : !rows ? <Empty>Loading...</Empty>
            : !rows.length ? <Empty>No audit entries yet</Empty> : (
              <div className="tw"><table>
                <thead><tr><th>Time</th><th>Action</th><th>Entity</th><th>ID</th></tr></thead>
                <tbody>
                  {rows.map((r, k) => {
                    const col = A_COL[r.action] || '#888'
                    return (
                      <tr key={k}>
                        <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--mu)' }}>{r.ts}</td>
                        <td><span className="badge" style={{ background: col + '22', color: col }}>{r.action}</span></td>
                        <td style={{ fontSize: 12 }}>{r.entity}</td>
                        <td style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--mu2)' }}>{r.entity_id}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table></div>
            )}
      </div>
    </>
  )
}
