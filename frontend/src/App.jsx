import React, { useState } from 'react'
import { AppProvider, useApp } from './store'
import Sidebar from './components/Sidebar'
import Toasts from './components/Toasts'
import Dashboard from './components/Dashboard'
import Members from './components/Members'
import Ideas from './components/Ideas'
import Sprints from './components/Sprints'
import Training from './components/Training'
import Defects from './components/Defects'
import ScrumBoard from './components/ScrumBoard'
import BoardSettings from './components/BoardSettings'
import Graphs from './components/Graphs'
import MemberAnalytics from './components/MemberAnalytics'
import Pods from './components/Pods'
import CustomFields from './components/CustomFields'
import DataQuality from './components/DataQuality'
import Audit from './components/Audit'
import Backups from './components/Backups'

const SECTIONS = {
  dashboard: Dashboard,
  members: Members,
  ideas: Ideas,
  sprints: Sprints,
  training: Training,
  defects: Defects,
  'scrum-board': ScrumBoard,
  'board-settings': BoardSettings,
  graphs: Graphs,
  'member-analytics': MemberAnalytics,
  pods: Pods,
  fields: CustomFields,
  'data-quality': DataQuality,
  audit: Audit,
  backups: Backups,
}

function LoadOverlay() {
  return (
    <div className="load-ov">
      <div className="spinner" />
      <div style={{ color: 'var(--mu2)', fontSize: 13 }}>Connecting to server...</div>
      <div style={{ color: 'var(--mu)', fontSize: 11 }}>/api</div>
    </div>
  )
}

function Shell() {
  const { loaded } = useApp()
  const [active, setActive] = useState('dashboard')
  if (!loaded) return <LoadOverlay />
  const Section = SECTIONS[active] || Dashboard
  return (
    <div className="app">
      <Sidebar active={active} onNav={setActive} />
      <div className="main">
        <Section onNav={setActive} />
      </div>
      <Toasts />
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  )
}
