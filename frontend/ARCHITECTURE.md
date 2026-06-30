# Frontend Architecture

The React UI is organised as a thin data/service layer feeding presentational
section components, with all shared state held in one context.

## Layers

### Data layer — `src/api.js`
A small `fetch` wrapper (`req`) with an 8s timeout and `{error}`-aware error
handling, plus one function per backend endpoint (pods, members, ideas,
sprints, training, fields, audit, health). Paths are relative (`/api/...`) and
proxied to the backend by Vite in dev.

### State / service layer — `src/store.jsx`
`AppProvider` exposes everything via the `useApp()` hook:
- `data` — the loaded snapshot (`pods, members, ideas, sprints, training, customFields`)
- `loadAll()` — parallel fetch of all collections; maps sprint fields
  (`member_id → member`, `target_ideas → targetIdeas`)
- `run(factory, okMsg)` — runs a mutating API call, reloads, and toasts
- `toast`, `toasts` — transient notifications
- `isAdmin` / `setIsAdmin` — client-side role toggle (gates edit/delete controls)
- `status` / `checkHealth` — backend connectivity indicator
- A 30s interval re-runs `loadAll()` so the UI tracks server state.

### View layer — `src/components/`
- **Shell:** `App.jsx` (provider + sidebar + active section + toasts),
  `Sidebar.jsx`, `Toasts.jsx`
- **Shared UI:** `ui.jsx` (`Avatar`, `StatusBadge`, `PodBadge`, `Modal`, `Field`,
  `Empty`), `PodFilter.jsx`, `CustomFieldInputs.jsx`, `ChartKit.jsx`
  (`Card`, `Delta`, `KpiCard`)
- **Sections:** `Dashboard`, `Members`, `Ideas`, `Sprints`, `Training`,
  `Graphs` (org-wide analytics), `MemberAnalytics` (per-member drill-down via a
  member selector), `Pods`, `CustomFields`, `Audit` — each renders its own
  toolbar and modals and reads/writes through `useApp()`.

### Helpers — `src/lib/`
- `helpers.js` — palette, `initials`, `memberByID`, `podColor`, avatar colours,
  status mappings, `implCount`/`progCount`, contributor resolution.
- `exports.js` — CSV export per view and a printable-PDF sprint report.

## Charts
`Graphs.jsx` uses `chart.js` (registered once at module load) via
`react-chartjs-2` — Bar, Line, Pie and Doughnut, themed for the dark palette.

## Data flow
User action → section calls `run(() => api.X(...))` → backend mutates →
`loadAll()` refreshes `data` → components re-render. Reads are pure functions of
`data`, so there is no imperative DOM update anywhere.
