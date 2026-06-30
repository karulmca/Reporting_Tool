import React, { useState } from 'react'
import { useApp } from '../store'

function FieldColumn({ entity, title, types, placeholder, optPlaceholder }) {
  const { data, run, api, toast } = useApp()
  const fields = data.customFields[entity] || []
  const [label, setLabel] = useState('')
  const [type, setType] = useState('text')
  const [opts, setOpts] = useState('')

  async function add() {
    if (!label.trim()) { toast('Label required', 'e'); return }
    const options = type === 'select' ? opts.split(',').map((x) => x.trim()).filter(Boolean) : []
    if (type === 'select' && !options.length) { toast('Add at least one option', 'e'); return }
    const ok = await run(() => api.createField({ entity, label: label.trim(), type, options }), 'Field added!')
    if (ok) { setLabel(''); setOpts('') }
  }
  function del(id) { run(() => api.deleteField(id), 'Field removed') }

  return (
    <div>
      <div className="sh">{title}</div>
      <div className="card">
        {fields.length ? fields.map((f) => (
          <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 0', borderBottom: '1px solid var(--b1)' }}>
            <span style={{ flex: 1, fontSize: 12.5, fontWeight: 500 }}>{f.label}</span>
            <span className="badge bb">{f.type}</span>
            {f.options && f.options.length ? <span style={{ fontSize: 11, color: 'var(--mu)' }}>{f.options.join(', ')}</span> : null}
            <button className="btn btn-sm btn-d" onClick={() => del(f.id)}>X</button>
          </div>
        )) : <div style={{ color: 'var(--mu)', fontSize: 12, padding: '8px 0' }}>No custom fields yet.</div>}

        <div className="dv" />
        <div className="fg2">
          <div><label className="fl">Label</label><input value={label} placeholder={placeholder} onChange={(e) => setLabel(e.target.value)} /></div>
          <div><label className="fl">Type</label>
            <select value={type} onChange={(e) => setType(e.target.value)}>
              {types.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
            </select>
          </div>
        </div>
        {type === 'select' && (
          <div style={{ marginTop: 8 }}><label className="fl">Options (comma sep.)</label><input value={opts} placeholder={optPlaceholder} onChange={(e) => setOpts(e.target.value)} /></div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}><button className="btn btn-p btn-sm" onClick={add}>+ Add Field</button></div>
      </div>
    </div>
  )
}

export default function CustomFields() {
  return (
    <>
      <div className="tb"><h2>Custom Fields</h2></div>
      <div className="con">
        <div className="g2">
          <FieldColumn entity="member" title="Fields on Member Records"
            types={[['text', 'Text'], ['number', 'Number'], ['select', 'Dropdown']]}
            placeholder="e.g. Department" optPlaceholder="A, B, C" />
          <FieldColumn entity="idea" title="Fields on Idea Records"
            types={[['text', 'Text'], ['number', 'Number'], ['select', 'Dropdown'], ['textarea', 'Long Text']]}
            placeholder="e.g. Business Value" optPlaceholder="Low, Medium, High" />
        </div>
      </div>
    </>
  )
}
