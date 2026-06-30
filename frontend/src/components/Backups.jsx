import React, { useState, useEffect, useCallback } from 'react'
import { useApp } from '../store'
import { backupDownloadURL } from '../api'
import { Empty, Modal, Field } from './ui'

function fmtSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
}

export default function Backups() {
  const { api, toast, loadAll, isAdmin } = useApp()
  const [rows, setRows] = useState(null)
  const [err, setErr] = useState(false)
  const [busy, setBusy] = useState(false)
  const [modal, setModal] = useState(false)
  const [label, setLabel] = useState('')

  const load = useCallback(async () => {
    setErr(false)
    try { setRows(await api.getBackups()) } catch { setErr(true) }
  }, [api])

  useEffect(() => { load() }, [load])

  const create = async () => {
    setBusy(true)
    try {
      await api.createBackup(label)
      toast('Backup created', 's')
      setModal(false); setLabel('')
      await load()
    } catch (e) { toast('Error: ' + e.message, 'e') }
    finally { setBusy(false) }
  }

  const restore = async (name) => {
    if (!window.confirm(`Restore "${name}"?\n\nThis replaces all current data with this backup. A safety snapshot of the current data is taken first.`)) return
    setBusy(true)
    try {
      await api.restoreBackup(name)
      toast('Restored - reloading data', 's')
      await load()
      await loadAll()
    } catch (e) { toast('Error: ' + e.message, 'e') }
    finally { setBusy(false) }
  }

  const remove = async (name) => {
    if (!window.confirm(`Delete backup "${name}"? This cannot be undone.`)) return
    setBusy(true)
    try {
      await api.deleteBackup(name)
      toast('Backup deleted', 'i')
      await load()
    } catch (e) { toast('Error: ' + e.message, 'e') }
    finally { setBusy(false) }
  }

  return (
    <>
      <div className="tb">
        <h2>Database Backups</h2>
        <div className="tb-r">
          <button className="btn btn-sm" onClick={load} disabled={busy}>&#8635; Refresh</button>
          {isAdmin && <button className="btn btn-sm btn-p" onClick={() => setModal(true)} disabled={busy}>+ Create Backup</button>}
        </div>
      </div>
      <div className="con">
        {err ? <Empty>Could not load backups</Empty>
          : !rows ? <Empty>Loading...</Empty>
            : !rows.length ? <Empty>No backups yet. Click "Create Backup" to save a snapshot of the current data.</Empty> : (
              <div className="tw"><table>
                <thead><tr><th>Backup</th><th>Created</th><th>Size</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.name}>
                      <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{r.name}</td>
                      <td style={{ fontSize: 12, color: 'var(--mu2)' }}>{r.created}</td>
                      <td style={{ fontSize: 12, color: 'var(--mu)' }}>{fmtSize(r.size)}</td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <a className="btn btn-sm" href={backupDownloadURL(r.name)} title="Download" style={{ textDecoration: 'none' }}>&#128190;</a>
                        {isAdmin && <button className="btn btn-sm" title="Restore" onClick={() => restore(r.name)} disabled={busy} style={{ marginLeft: 6 }}>&#8635; Restore</button>}
                        {isAdmin && <button className="btn btn-sm btn-d" title="Delete" onClick={() => remove(r.name)} disabled={busy} style={{ marginLeft: 6 }}>&#10005;</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            )}
      </div>

      <Modal open={modal} title="Create Backup" onClose={() => setModal(false)}
        footer={<>
          <button className="btn" onClick={() => setModal(false)} disabled={busy}>Cancel</button>
          <button className="btn btn-p" onClick={create} disabled={busy}>{busy ? 'Saving...' : 'Create'}</button>
        </>}>
        <Field label="Label (optional)">
          <input value={label} maxLength={40} placeholder="e.g. before-sprint-import"
            onChange={(e) => setLabel(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !busy) create() }} />
        </Field>
        <div style={{ fontSize: 12, color: 'var(--mu)' }}>A timestamped snapshot of the current database is saved on the server. You can restore it later to bring back this exact data.</div>
      </Modal>
    </>
  )
}
