import React from 'react'
import { useApp } from '../store'

export default function Toasts() {
  const { toasts } = useApp()
  return (
    <div className="tw2">
      {toasts.map((t) => (
        <div key={t.id} className={'tst ' + (t.type || 's')}>{t.msg}</div>
      ))}
    </div>
  )
}
