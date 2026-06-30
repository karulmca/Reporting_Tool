# BlueBolt Innovation Tracker — Backend (FastAPI)

FastAPI backend for the **BlueBolt Innovation Tracker**. It stores PODs, members,
ideas, sprint story-points, training status and user-defined custom fields in
SQLite, exposes them under `/api/*`, and serves the single-page UI
(`static/index.html`) from the same origin.

## Setup

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## Run

```powershell
python main.py
```

Then open <http://localhost:8080> in a browser. The server listens on port
**8080** and the UI talks to the API on the same host/port. A small demo dataset
is seeded automatically the first time the database (`bluebolt.db`) is created.

(For auto-reload during development you can instead run
`uvicorn main:app --reload --port 8080`.)

## API

All endpoints are prefixed with `/api`.

| Method | Path | Purpose |
| ------ | ---- | ------- |
| GET/POST | `/api/pods` | List / create PODs |
| PUT/DELETE | `/api/pods/{code}` | Update / delete a POD (delete blocked if it has members) |
| GET/POST | `/api/members` | List / create members |
| PUT/DELETE | `/api/members/{id}` | Update / delete a member |
| GET/POST | `/api/ideas` | List / create ideas |
| PUT/DELETE | `/api/ideas/{id}` | Update / delete an idea |
| GET/POST | `/api/sprints` | List / upsert (by member+sprint) sprint records |
| GET/POST | `/api/training/courses` | List / add training courses |
| GET/POST | `/api/training/status` | Status matrix / set one member-course status |
| GET/POST | `/api/fields` | List (grouped by entity) / create custom fields |
| DELETE | `/api/fields/{id}` | Delete a custom field |
| GET | `/api/audit` | Recent mutation history |
| GET | `/api/health` | Health check + record counts |
| GET | `/api/backup` | Download the SQLite database file |

## Layout (MVC)

- **Model** — `models.py` (SQLModel tables), `database.py` (engine + seed)
- **Service** — `services/*_service.py` (business logic, audit logging)
- **Route** — `routes/*.py` (FastAPI routers under `/api`)
- **View** — `static/index.html` (single-page UI served at `/`)
