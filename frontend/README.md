# BlueBolt Innovation Tracker — Frontend (React + Vite)

The React UI for the BlueBolt Innovation Tracker. It talks to the FastAPI
backend through `/api/*`, which Vite proxies to `http://localhost:8080` in dev
(see `vite.config.js`).

## Quick start

```powershell
cd frontend
npm install
npm run dev
```

Open <http://localhost:5173>. Make sure the backend is running
(`cd backend; python main.py`) so the `/api` proxy has something to reach.

## Structure

```
src/
  api.js                 # fetch wrapper + one function per endpoint
  store.jsx              # AppProvider/useApp: data load, 30s poll, CRUD runner, toasts, role, health
  styles.css             # ported BlueBolt dark theme
  lib/
    helpers.js           # palette, initials, colour/lookup/count helpers
    exports.js           # CSV + printable-PDF exports
  components/
    Sidebar.jsx  Toasts.jsx  ui.jsx (Avatar/StatusBadge/Modal/Field)
    PodFilter.jsx  CustomFieldInputs.jsx
    Dashboard.jsx  Members.jsx  Ideas.jsx  Sprints.jsx
    Training.jsx  Graphs.jsx  Pods.jsx  CustomFields.jsx  Audit.jsx
  App.jsx                # shell: provider + sidebar + active section + toasts
  main.jsx               # React entry
```

Charts use `chart.js` via `react-chartjs-2`. State is centralised in
`store.jsx`; each mutating action calls the API and then reloads, so the UI
always reflects server state (it also auto-refreshes every 30s).
