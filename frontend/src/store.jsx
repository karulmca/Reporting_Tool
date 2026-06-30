import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import * as api from './api'

const AppCtx = createContext(null)
export function useApp() {
  return useContext(AppCtx)
}

const EMPTY = {
  pods: [], members: [], ideas: [], sprints: [], defects: [],
  training: { courses: [], status: {}, statusOptions: [] },
  customFields: { member: [], idea: [], workitem: [] },
  board: { frameworks: [], iterations: {} },
}

export function AppProvider({ children }) {
  const [data, setData] = useState(EMPTY)
  const [isAdmin, setIsAdmin] = useState(true)
  const [status, setStatus] = useState({ state: 'loading', label: 'Connecting...' })
  const [loaded, setLoaded] = useState(false)
  const [toasts, setToasts] = useState([])
  const idRef = useRef(0)

  const toast = useCallback((msg, type = 's') => {
    const id = ++idRef.current
    setToasts((t) => [...t, { id, msg, type }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2800)
  }, [])

  const loadAll = useCallback(async () => {
    setStatus({ state: 'loading', label: 'Loading...' })
    try {
      const [pods, members, ideas, sprintsRaw, courses, tstatus, fields, statusOptions, defects, board] = await Promise.all([
        api.getPods(), api.getMembers(), api.getIdeas(), api.getSprints(),
        api.getCourses(), api.getTrainingStatus(), api.getFields(), api.getStatusOptions(),
        api.getDefects(), api.getBoardConfig(),
      ])
      const sprints = sprintsRaw.map((s) => ({ ...s, member: s.member_id, targetIdeas: s.target_ideas }))
      setData({ pods, members, ideas, sprints, defects, board, training: { courses, status: tstatus, statusOptions }, customFields: fields })
      setStatus({ state: 'ok', label: members.length + 'm / ' + ideas.length + ' ideas' })
      setLoaded(true)
      return true
    } catch {
      setStatus({ state: 'err', label: 'Server unreachable' })
      setLoaded(true)
      return false
    }
  }, [])

  // Run a mutating API call, then refresh + toast (mirrors the original flow).
  const run = useCallback(async (factory, okMsg) => {
    try {
      await factory()
      await loadAll()
      if (okMsg) toast(okMsg, 's')
      return true
    } catch (e) {
      toast('Error: ' + e.message, 'e')
      return false
    }
  }, [loadAll, toast])

  const checkHealth = useCallback(async () => {
    try {
      const h = await api.health()
      setStatus({ state: 'ok', label: h.members + 'm / ' + h.ideas + 'i / ' + h.sprints + 's' })
      toast('Server OK', 's')
    } catch {
      setStatus({ state: 'err', label: 'Unreachable' })
      toast('Server not reachable', 'e')
    }
  }, [toast])

  useEffect(() => { loadAll() }, [loadAll])
  useEffect(() => {
    const t = setInterval(() => { loadAll() }, 30000)
    return () => clearInterval(t)
  }, [loadAll])

  const value = {
    data, isAdmin, setIsAdmin, status, loaded, toasts, toast,
    loadAll, run, checkHealth, api,
  }
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>
}
