import React from 'react'

// Renders inputs for a list of custom-field definitions bound to a values map.
export default function CustomFieldInputs({ fields, values, onChange }) {
  if (!fields || !fields.length) return null
  return (
    <>
      <div className="dv" />
      {fields.map((f) => {
        const v = values[f.id] || ''
        const set = (e) => onChange(f.id, e.target.value)
        let input
        if (f.type === 'select') {
          input = <select value={v} onChange={set}>{(f.options || []).map((o) => <option key={o}>{o}</option>)}</select>
        } else if (f.type === 'textarea') {
          input = <textarea value={v} onChange={set} placeholder={f.label} />
        } else {
          input = <input type={f.type === 'number' ? 'number' : 'text'} value={v} onChange={set} placeholder={f.label} />
        }
        return <div className="fr" key={f.id}><label className="fl">{f.label}</label>{input}</div>
      })}
    </>
  )
}
