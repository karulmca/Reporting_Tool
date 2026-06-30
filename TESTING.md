# Reporting Tools - Testing Guide

## Automated Tests

The project has automated test suites for both tiers.

### Backend — pytest (FastAPI TestClient)

Integration tests covering every API module (pods, members, ideas, sprints,
training, fields, defects, board, backups, misc). Each run uses a throwaway
SQLite database (via the `BLUEBOLT_DB` env var) so your real `bluebolt.db` is
never touched.

```powershell
cd backend
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt   # one-time
.\.venv\Scripts\python.exe -m pytest
```

### Frontend — Vitest + React Testing Library

Unit tests for the pure helpers/analytics and the API client, plus component
tests for the shared UI primitives and the Backups view (jsdom environment).

```powershell
cd frontend
npm install --include=dev    # NOTE: required because NODE_ENV=production is set
npm test                     # one-off run  (npm run test:watch for watch mode)
```

> Heads-up: this machine has `NODE_ENV=production` in the environment, so a plain
> `npm install` **skips and prunes devDependencies** (including Vite and Vitest).
> Always use `npm install --include=dev` here, or unset `NODE_ENV` first.

Test layout:
- `backend/tests/` — `conftest.py` + `test_*.py` (one file per module)
- `frontend/src/**/*.test.{js,jsx}` — colocated with the code they cover

---

## Prerequisites

- Node.js 16+ and npm (for frontend)
- Python 3.8+ (for backend)
- PowerShell or Terminal

## Backend Setup & Testing

### Step 1: Install Backend Dependencies

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate
pip install -r requirements.txt
```

### Step 2: Start Backend Server

```powershell
uvicorn main:app --reload --port 8000
```

Expected output:
```
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
INFO:     Application startup complete
```

### Step 3: Test Backend Endpoints

#### Health Check
```bash
curl http://localhost:8000/health
# Response: {"status":"ok"}
```

#### Create Schema
```bash
curl -X POST http://localhost:8000/schemas \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Sales Metrics",
    "json_schema": {
      "type": "object",
      "properties": {
        "revenue": {"type": "number"},
        "units_sold": {"type": "number"}
      },
      "required": ["revenue"]
    }
  }'
```

#### List Schemas
```bash
curl http://localhost:8000/schemas
```

#### Create Record
```bash
curl -X POST http://localhost:8000/records \
  -H "Content-Type: application/json" \
  -d '{
    "schema_id": 1,
    "user": "john_sales",
    "data": {"revenue": 50000, "units_sold": 100}
  }'
```

#### List Records
```bash
curl "http://localhost:8000/records?schema_id=1"
```

#### Create Target
```bash
curl -X POST http://localhost:8000/targets \
  -H "Content-Type: application/json" \
  -d '{
    "schema_id": 1,
    "user": "john_sales",
    "metric_key": "revenue",
    "period_start": 1748822400,
    "period_end": 1749427200,
    "target_value": 100000
  }'
```

#### Get Progress Report
```bash
curl "http://localhost:8000/reports/progress?schema_id=1&metric_key=revenue&period=weekly"
```

---

## Frontend Setup & Testing

### Step 1: Install Frontend Dependencies

```powershell
cd frontend
npm install
```

### Step 2: Start Frontend Development Server

```powershell
npm run dev
```

Expected output:
```
  VITE v5.0.0  ready in 123 ms

  ➜  Local:   http://localhost:5173/
  ➜  press h + enter to show help
```

### Step 3: Test Frontend in Browser

1. Open browser to `http://localhost:5173`
2. **Auth Screen**: Enter your name and click "Sign In"
3. You should see the main app with two tabs:
   - **Field Builder** - Create dynamic form schemas
   - **Report** - Submit records and view reports

### Step 4: Test Field Builder Tab

1. Click "Field Builder" tab
2. Create a field:
   - Field Name: `revenue`
   - Field Label: `Revenue ($)`
   - Field Type: `number`
   - Click "Add Field"
3. Add another field:
   - Field Name: `units`
   - Field Label: `Units Sold`
   - Field Type: `number`
   - Click "Add Field"
4. Click "Save to Server" button
5. Enter schema name: `Sales` and click OK
6. Verify "Saved to server!" message appears
7. Test "Refresh from Server" - schema should appear in dropdown and auto-load

### Step 5: Test Report Tab

1. Click "Report" tab
2. Select the `Sales` schema from dropdown
3. Fill in the form:
   - Revenue: `50000`
   - Units Sold: `100`
4. Click "Submit Record"
5. Verify "Record saved!" message
6. Records should appear in the table below
7. Try CSV export - should download `records.csv`
8. Try PDF export - should download `chart.pdf`

---

## Integration Testing Checklist

### Frontend ↔ Backend Communication

- [ ] Backend server running on http://localhost:8000
- [ ] Frontend server running on http://localhost:5173
- [ ] Auth flow works (name → localStorage)
- [ ] Field Builder saves schema to backend
- [ ] Field Builder retrieves schema from backend
- [ ] Report tab creates records in backend
- [ ] Records table shows data from backend
- [ ] CSV export includes all records
- [ ] PDF export includes chart visualization

### Data Validation

- [ ] Invalid record data is rejected (validation error shown)
- [ ] Empty required fields are caught
- [ ] Number fields reject non-numeric input
- [ ] Date fields are properly formatted

### Error Handling

- [ ] Network errors show helpful messages
- [ ] 404 errors handled gracefully
- [ ] Backend validation errors displayed to user
- [ ] Logout clears localStorage and returns to auth

---

## Testing the MVC Architecture

### Backend MVC Verification

1. **Models Layer**: Check `backend/models.py`
   - Verify FieldSchema, Record, Target models exist
   - Verify SQLite database creation works

2. **Services Layer**: Check `backend/services/`
   - Verify schema_service.py has SchemaService class
   - Verify record_service.py validates against JSON Schema
   - Verify target_service.py manages targets
   - Verify report_service.py calculates weekly/monthly progress

3. **Routes Layer**: Check `backend/routes/`
   - Verify schemas.py router works
   - Verify records.py router validates input
   - Verify targets.py router works
   - Verify reports.py router aggregates correctly

### Frontend MVC Verification

1. **Model Layer**: Check `frontend/src/api.js`
   - Verify all API functions exist
   - Verify correct endpoints are called

2. **Service Layer**: Check `frontend/src/hooks/`
   - Verify useSchemaService hook
   - Verify useRecordService hook
   - Verify useTargetService hook
   - Verify useReportService hook

3. **View Layer**: Check `frontend/src/components/`
   - Verify components use hooks, not direct API calls
   - Verify components are presentation-focused

4. **Utilities**: Check `frontend/src/utils/`
   - Verify dateUtils functions work
   - Verify validation functions work

---

## Troubleshooting

### Backend Issues

**Port 8000 already in use**
```powershell
# Find and kill process
Get-Process -Id (Get-NetTCPConnection -LocalPort 8000).OwningProcess | Stop-Process
```

**Database file locked**
- Delete `backend/reporting.db` to reset database
- Database will be recreated on next startup

**Import errors**
- Ensure virtual environment is activated
- Run `pip install -r requirements.txt` again

### Frontend Issues

**Port 5173 already in use**
- Vite will try 5174, 5175, etc.
- Check URL in terminal output

**CORS errors**
- Verify backend is running on localhost:8000
- Check backend has correct CORS configuration
- Verify api.js BASE URL is correct

**Blank page or errors**
- Open browser DevTools (F12) to see console errors
- Check frontend server output for compilation errors

---

## Performance Testing (Optional)

### Load Test Backend
```powershell
# Create 100 records quickly
$schema_id = 1
for ($i = 1; $i -le 100; $i++) {
  $body = @{
    schema_id = $schema_id
    user = "test_user_$i"
    data = @{revenue = ($i * 1000); units_sold = $i}
  } | ConvertTo-Json
  
  curl -X POST http://localhost:8000/records `
    -H "Content-Type: application/json" `
    -d $body
}
```

### Test Report Generation
```powershell
# Generate report for all records
curl "http://localhost:8000/reports/progress?schema_id=1&metric_key=revenue&period=weekly"
```

---

## Next Steps

1. ✅ Run backend and verify health endpoint
2. ✅ Run frontend and verify auth flow
3. ✅ Create schema via Field Builder
4. ✅ Submit records via Report tab
5. ✅ Verify data appears in records list
6. ✅ Test CSV/PDF export
7. Create target via API (next feature)
8. View progress report (next feature)
9. Deploy to production
