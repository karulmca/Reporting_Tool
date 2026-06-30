# Reporting Tools - Team Productivity & Progress Tracker

A comprehensive full-stack web application for tracking team productivity metrics with dynamic field definitions, progress reporting, and data visualization.

## Features

✨ **Dynamic Field Builder**
- Create custom form schemas with dynamic fields
- Add/remove fields on the fly
- Support for text, number, date, and enum field types
- Export/import schemas as JSON

📊 **Data Entry & Records**
- Dynamic form rendering from schema
- Real-time validation
- Multi-user support
- CSV export of all records
- PDF export with charts

🎯 **Target Management**
- Set weekly and monthly targets per user/metric
- Track progress against targets
- Automatic aggregation and calculation

📈 **Progress Reporting**
- Weekly aggregation of metrics
- Monthly aggregation of metrics
- Progress calculation: (actual / target) * 100%
- Progress visualization with charts
- Filter by schema, user, metric, and date range

👥 **User Management**
- Simple name-based authentication
- Per-user record and target tracking
- Secure logout

## Tech Stack

### Frontend
- **React 18.2** - UI framework
- **Vite 5.0** - Build tool & dev server
- **Material-UI 5.14** - Component library
- **Recharts 2.6** - Data visualization
- **@rjsf/core 5.0** - Dynamic form rendering
- **html2canvas & jsPDF** - PDF export

### Backend
- **FastAPI 0.95** - Web framework
- **SQLModel 0.0.8** - ORM (SQLAlchemy + Pydantic)
- **SQLite** - Database
- **Uvicorn** - ASGI server
- **Python 3.8+**

### Architecture
- **MVC Pattern** - Clean separation of concerns
- **Service-based** - Reusable business logic
- **REST API** - Standard HTTP endpoints
- **Type-safe** - Full type hints and validation

## Project Structure

```
Reporting_Tools/
├── frontend/                 # React + Vite application
│   ├── src/
│   │   ├── api.js           # API client (data layer)
│   │   ├── App.jsx          # Main app shell
│   │   ├── components/      # UI components (view layer)
│   │   ├── hooks/           # Custom hooks (service layer)
│   │   └── utils/           # Utilities & helpers
│   ├── package.json
│   └── ARCHITECTURE.md       # Frontend architecture docs
│
├── backend/                  # FastAPI application
│   ├── main.py              # App initialization & routing
│   ├── models.py            # SQLModel definitions (data layer)
│   ├── services/            # Business logic (service layer)
│   ├── routes/              # API endpoints (route layer)
│   ├── requirements.txt      # Python dependencies
│   └── ARCHITECTURE.md       # Backend architecture docs
│
├── TESTING.md               # Comprehensive testing guide
└── README.md               # This file
```

## Quick Start

> **Note:** The active application is the **BlueBolt Innovation Tracker** — a
> FastAPI backend (`backend/`) plus a React + Vite front end (`frontend/`).
> (The sections further below describe the earlier generic reporting prototype
> and are kept for reference only.)

### Prerequisites
- Python 3.8+
- Node.js 16+ and npm

### One command (recommended)
From the project root run `.\quickstart.ps1` (Windows) or `./quickstart.sh`
(Unix). This sets up and starts both servers and opens the app.

### Manual start

Backend (terminal 1):
```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate
pip install -r requirements.txt
python main.py            # serves the API on http://localhost:8080
```

Frontend (terminal 2):
```powershell
cd frontend
npm install
npm run dev               # React UI on http://localhost:5173
```

### Access Application
1. Open browser to **http://localhost:5173**
2. The React app proxies all `/api` calls to the backend on :8080 (configured in
   `vite.config.js`), so there are no CORS concerns.
3. Use the sidebar to manage PODs, Members, Ideas, Sprints and Training. A small
   demo dataset is seeded on first run.
4. Health check / API base: `http://localhost:8080/api/health`

> The backend also serves a dependency-free vanilla-JS build of the same UI at
> `http://localhost:8080/` (`backend/static/index.html`) if you ever want to run
> without Node.

See [backend/README.md](backend/README.md) for the full API reference and
[frontend/ARCHITECTURE.md](frontend/ARCHITECTURE.md) for the React structure.

## API Endpoints

### Schemas
- `GET /schemas` - List all schemas
- `POST /schemas` - Create schema
- `GET /schemas/{id}` - Get specific schema
- `PUT /schemas/{id}` - Update schema
- `DELETE /schemas/{id}` - Delete schema

### Records
- `GET /records?schema_id=...` - List records (filtered by schema)
- `POST /records` - Create record (validates against schema)
- `GET /records/{id}` - Get specific record
- `DELETE /records/{id}` - Delete record

### Targets
- `GET /targets?schema_id=...&user=...` - List targets
- `POST /targets` - Create target
- `GET /targets/{id}` - Get specific target
- `PUT /targets/{id}` - Update target
- `DELETE /targets/{id}` - Delete target

### Reports
- `GET /reports/progress?schema_id=...&metric_key=...&period=weekly|monthly&user=...&start=...&end=...`
  - Returns aggregated progress data with calculations

### Health
- `GET /health` - Health check

## MVC Architecture

### Backend MVC
- **Model**: SQLModel ORM in `models.py`
- **Controller**: Business logic services in `services/`
- **View**: FastAPI routes in `routes/`

### Frontend MVC
- **Model**: API client in `api.js`
- **Controller**: Custom hooks in `hooks/`
- **View**: React components in `components/`

See [ARCHITECTURE.md](backend/ARCHITECTURE.md) and [frontend/ARCHITECTURE.md](frontend/ARCHITECTURE.md) for detailed documentation.

## Usage Examples

### Create a Schema
```javascript
// Via API
POST http://localhost:8000/schemas
{
  "name": "Weekly Sales",
  "json_schema": {
    "type": "object",
    "properties": {
      "revenue": {"type": "number"},
      "units_sold": {"type": "number"}
    },
    "required": ["revenue"]
  }
}
```

### Submit a Record
```javascript
POST http://localhost:8000/records
{
  "schema_id": 1,
  "user": "john_smith",
  "data": {
    "revenue": 50000,
    "units_sold": 100
  }
}
```

### Create a Target
```javascript
POST http://localhost:8000/targets
{
  "schema_id": 1,
  "user": "john_smith",
  "metric_key": "revenue",
  "period_start": 1748822400,  // Unix timestamp
  "period_end": 1749427200,    // Unix timestamp
  "target_value": 100000
}
```

### Get Progress Report
```javascript
GET http://localhost:8000/reports/progress?schema_id=1&metric_key=revenue&period=weekly
```

Response:
```json
{
  "period_start": 1748822400,
  "period_end": 1749427200,
  "metric_key": "revenue",
  "results": [
    {
      "user": "john_smith",
      "actual": 75000,
      "target": 100000,
      "percent": 75.0
    }
  ]
}
```

## Key Features Explained

### Dynamic Fields
- Create form schemas without code changes
- Fields stored as JSON Schema in database
- Real-time validation on record submission
- Support for various field types (text, number, date, enum)

### Data Aggregation
- Automatic weekly aggregation (Monday-Sunday)
- Automatic monthly aggregation (1st-last day of month)
- Sum values across all records in period
- Match targets by period overlap
- Calculate achievement percentages

### Export Options
- **CSV Export**: Download all records as CSV file
- **PDF Export**: Generate PDF with chart visualization

### Multi-user Support
- Track metrics per user
- Per-user targets
- Per-user progress reports
- Aggregated team dashboards

## Development Guide

### Adding New Features

1. **Backend**: 
   - Add model in `models.py` if needed
   - Add service methods in `services/`
   - Add routes in `routes/`
   - Test with curl or Postman

2. **Frontend**:
   - Add API functions in `api.js`
   - Add service hook in `hooks/`
   - Create component in `components/`
   - Use hook in component

3. **Testing**:
   - Manual test in browser
   - Test API with curl
   - Check console for errors
   - Verify database state

### Code Style

- **Python**: Follow PEP 8
- **JavaScript**: Use ESLint configuration
- **React**: Functional components with hooks
- **Database**: Use SQLModel for type safety

## Troubleshooting

### Backend won't start
1. Check if port 8000 is in use
2. Verify Python 3.8+ is installed
3. Verify all dependencies installed: `pip install -r requirements.txt`
4. Check for syntax errors: `python -m py_compile main.py`

### Frontend won't load
1. Check if port 5173 is in use
2. Verify Node.js 16+ installed
3. Verify all dependencies installed: `npm install`
4. Check browser console (F12) for errors

### Records not saving
1. Verify backend is running on port 8000
2. Check browser console for CORS errors
3. Verify schema is created before submitting records
4. Check backend logs for validation errors

### Database issues
1. Delete `backend/reporting.db` to reset
2. Restart backend server
3. Database will be recreated automatically

## Future Enhancements

- 🔐 Role-based access control (admin, manager, user)
- 📧 Email notifications for target achievement
- 📱 Mobile app (React Native)
- 🔄 Real-time sync with WebSockets
- 🤖 Predictive analytics with ML
- 📊 Advanced dashboard with multiple chart types
- 🔔 Alerts and notifications
- 📅 Calendar view for targets
- 🏆 Gamification (badges, leaderboards)
- 🌐 Multi-language support

## License

MIT License - See LICENSE file for details

## Support

For issues, questions, or suggestions:
1. Check [TESTING.md](TESTING.md) for troubleshooting
2. Review [backend/ARCHITECTURE.md](backend/ARCHITECTURE.md) for backend details
3. Review [frontend/ARCHITECTURE.md](frontend/ARCHITECTURE.md) for frontend details

---

**Status**: ✅ MVC refactoring complete, ready for testing

**Last Updated**: June 1, 2026
