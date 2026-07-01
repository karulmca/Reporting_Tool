// API client for the BlueBolt backend. Paths are relative ("/api/..."); in dev
// Vite proxies them to the FastAPI server on :8080 (see vite.config.js).
const BASE = '/api'

async function req(path, method = 'GET', body, timeoutMs = 8000) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } }
  if (body) opts.body = JSON.stringify(body)
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  opts.signal = ctrl.signal
  try {
    const res = await fetch(BASE + path, opts)
    if (!res.ok) {
      let e = {}
      try { e = await res.json() } catch { /* ignore */ }
      throw new Error(e.error || 'HTTP ' + res.status)
    }
    return await res.json()
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('Timeout - server not responding')
    throw e
  } finally {
    clearTimeout(timer)
  }
}

const enc = encodeURIComponent

export const getPods = () => req('/pods')
export const createPod = (p) => req('/pods', 'POST', p)
export const updatePod = (code, p) => req('/pods/' + enc(code), 'PUT', p)
export const deletePod = (code) => req('/pods/' + enc(code), 'DELETE')

export const getMembers = () => req('/members')
export const createMember = (m) => req('/members', 'POST', m)
export const bulkMembers = (rows) => req('/members/bulk', 'POST', { rows })
export const updateMember = (id, m) => req('/members/' + enc(id), 'PUT', m)
export const deleteMember = (id) => req('/members/' + enc(id), 'DELETE')

export const getIdeas = () => req('/ideas')
export const createIdea = (i) => req('/ideas', 'POST', i)
export const bulkIdeas = (rows) => req('/ideas/bulk', 'POST', { rows })
export const updateIdea = (id, i) => req('/ideas/' + enc(id), 'PUT', i)
export const deleteIdea = (id) => req('/ideas/' + enc(id), 'DELETE')

export const getSprints = () => req('/sprints')
export const upsertSprint = (s) => req('/sprints', 'POST', s)
export const bulkSprints = (rows) => req('/sprints/bulk', 'POST', { rows })
export const deleteSprint = (member, sprint) => req('/sprints?member=' + enc(member) + '&sprint=' + enc(sprint), 'DELETE')
export const deleteSprintByName = (sprint) => req('/sprints/by-name?sprint=' + enc(sprint), 'DELETE')
export const renameSprint = (oldName, newName) => req('/sprints/rename', 'PUT', { old: oldName, new: newName })

export const getCourses = () => req('/training/courses')
export const addCourse = (c) => req('/training/courses', 'POST', c)
export const updateCourse = (id, c) => req('/training/courses/' + enc(id), 'PUT', c)
export const deleteCourse = (id) => req('/training/courses/' + enc(id), 'DELETE')
export const getTrainingStatus = () => req('/training/status')
export const setTrainingStatus = (s) => req('/training/status', 'POST', s)
export const getStatusOptions = () => req('/training/statuses')
export const addStatusOption = (o) => req('/training/statuses', 'POST', o)
export const updateStatusOption = (id, o) => req('/training/statuses/' + enc(id), 'PUT', o)
export const deleteStatusOption = (id) => req('/training/statuses/' + enc(id), 'DELETE')

export const getFields = () => req('/fields')
export const createField = (f) => req('/fields', 'POST', f)
export const updateField = (id, f) => req('/fields/' + enc(id), 'PUT', f)
export const reorderFields = (ids) => req('/fields/reorder', 'PUT', { ids })
export const deleteField = (id) => req('/fields/' + enc(id), 'DELETE')

// ---- Scrum board: configuration (frameworks own columns + types) ----
export const getBoardConfig = () => req('/board/config')
export const createFramework = (f) => req('/board/frameworks', 'POST', f)
export const updateFramework = (id, f) => req('/board/frameworks/' + enc(id), 'PUT', f)
export const deleteFramework = (id) => req('/board/frameworks/' + enc(id), 'DELETE')
export const createColumn = (c) => req('/board/columns', 'POST', c)
export const updateColumn = (id, c) => req('/board/columns/' + enc(id), 'PUT', c)
export const deleteColumn = (id) => req('/board/columns/' + enc(id), 'DELETE')
export const reorderColumns = (ids) => req('/board/columns/reorder', 'PUT', { ids })
export const createWIType = (t) => req('/board/types', 'POST', t)
export const updateWIType = (id, t) => req('/board/types/' + enc(id), 'PUT', t)
export const deleteWIType = (id) => req('/board/types/' + enc(id), 'DELETE')
export const getIterations = (pod) => req('/board/iterations?pod=' + enc(pod || ''))
export const addIteration = (it) => req('/board/iterations', 'POST', it)
export const deleteIteration = (id) => req('/board/iterations/' + enc(id), 'DELETE')

// ---- Scrum board: work items ----
export const getWorkItems = (sprint, pod) => req('/board/items?sprint=' + enc(sprint || '') + '&pod=' + enc(pod || ''))
export const createWorkItem = (w) => req('/board/items', 'POST', w)
export const updateWorkItem = (id, w) => req('/board/items/' + enc(id), 'PUT', w)
export const moveWorkItem = (id, m) => req('/board/items/' + enc(id) + '/move', 'PUT', m)
export const deleteWorkItem = (id) => req('/board/items/' + enc(id), 'DELETE')
export const getItemUpdates = (id) => req('/board/items/' + enc(id) + '/updates')
export const addItemUpdate = (id, u) => req('/board/items/' + enc(id) + '/updates', 'POST', u)
export const deleteItemUpdate = (uid) => req('/board/updates/' + enc(uid), 'DELETE')

export const getDefects = () => req('/defects')
export const getDefectReport = () => req('/defects/report')
export const createDefect = (d) => req('/defects', 'POST', d)
export const bulkDefects = (rows) => req('/defects/bulk', 'POST', { rows })
export const updateDefect = (id, d) => req('/defects/' + enc(id), 'PUT', d)
export const deleteDefect = (id) => req('/defects/' + enc(id), 'DELETE')

export const getAudit = () => req('/audit')
export const health = () => req('/health')

// ---- Automated test report ----
export const getTestReport = () => req('/tests/report')
// Running tests is slow (a few seconds to ~30s), so use a generous timeout.
export const runTests = (suite = 'all') => req('/tests/run?suite=' + enc(suite), 'POST', undefined, 240000)

// ---- Database backups (server-side snapshots) ----
export const getBackups = () => req('/backups')
export const createBackup = (label) => req('/backups', 'POST', { label: label || '' })
export const restoreBackup = (name) => req('/backups/' + enc(name) + '/restore', 'POST')
export const deleteBackup = (name) => req('/backups/' + enc(name), 'DELETE')
export const backupDownloadURL = (name) => BASE + '/backups/' + enc(name) + '/download'

export const BACKUP_URL = BASE + '/backup'
