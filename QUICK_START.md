# Quick Start Guide - Complete API & UI Access

Follow these steps to start the application and access all UI components.

---

## Prerequisites

- Node.js 16+ (for frontend)
- Python 3.8+ (for backend)
- PowerShell or Terminal

---

## Step 1: Setup Backend

### Open Terminal 1 (Backend)

```powershell
# Navigate to backend directory
cd backend

# Create virtual environment (if not exists)
python -m venv .venv

# Activate virtual environment
.\.venv\Scripts\Activate

# Install dependencies
pip install -r requirements.txt

# Start backend server
uvicorn main:app --reload --port 8000
```

**Expected Output:**
```
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
INFO:     Application startup complete
```

**Verify Backend Health:**
```powershell
# Open another PowerShell and run:
curl http://localhost:8000/health
# Should return: {"status":"ok"}
```

---

## Step 2: Setup Frontend

### Open Terminal 2 (Frontend)

```powershell
# Navigate to frontend directory
cd frontend

# Install dependencies (if not installed)
npm install

# Start dev server
npm run dev
```

**Expected Output:**
```
VITE v5.0.0  ready in 234 ms

➜  Local:   http://localhost:5173/
➜  press h to show help
```

---

## Step 3: Access the Application

1. **Open Browser:** http://localhost:5173/
2. **Sign In:** Enter your name (e.g., "John Smith")
3. **Click Sign In** - You'll see 4 tabs:
   - Field Builder
   - Report
   - Targets
   - Dashboard

---

## Step 4: Complete Workflow Test

### 4.1 Create a Schema (Tab 0: Field Builder)

1. Click **Field Builder** tab
2. Add fields:
   - **Label:** "Revenue", **Key:** "revenue", **Type:** Number
   - **Label:** "Units Sold", **Key:** "units", **Type:** Number
3. Click **Save to Server**
4. Enter Schema Name: "Sales Metrics"
5. Click **Save**

**API Called:** `POST /schemas`

---

### 4.2 Submit Records (Tab 1: Report)

1. Click **Report** tab
2. In "Select a Server Schema" dropdown, select "Sales Metrics"
3. Click **Load Schema**
4. Fill the form:
   - **Revenue:** 5000
   - **Units Sold:** 100
5. Click **Submit**
6. See record appear in table
7. Add another record (different values)

**APIs Called:**
- `GET /schemas` (populate dropdown)
- `POST /records` (submit form)
- `GET /records` (display table)

---

### 4.3 Create Targets (Tab 2: Targets)

1. Click **Targets** tab
2. Select "Sales Metrics" from schema dropdown
3. Click **Create Target** button
4. Fill dialog:
   - **Metric Key:** "revenue"
   - **Target Value:** 5000
   - **Period Start:** Today's date
   - **Period End:** Today's date + 7 days
   - **User:** Leave as default
5. Click **Create**
6. See target in table below

**APIs Called:**
- `GET /schemas` (dropdown)
- `POST /targets` (create target)
- `GET /targets` (display table)

---

### 4.4 View Dashboard & Progress (Tab 3: Dashboard)

1. Click **Dashboard** tab
2. Select "Sales Metrics" from Schema dropdown
3. Metric dropdown auto-populates (select "revenue")
4. Period: Keep as "Weekly"
5. User: Leave empty (shows all users)
6. Click **Generate Report**
7. See:
   - **Bar Chart:** Comparing actual vs target
   - **Progress Table:** Shows user, actual, target, progress %

**APIs Called:**
- `GET /schemas` (dropdown)
- `GET /schemas/{id}` (fetch metrics)
- `GET /reports/progress` (fetch aggregated data)

---

## Step 5: Verify All API Endpoints

### Test Schema API
```powershell
# GET /schemas
curl http://localhost:8000/schemas | ConvertFrom-Json | ConvertTo-Json

# POST /schemas
$body = @{name="Test Schema"; json_schema=@{type="object"; properties=@{}}} | ConvertTo-Json
curl -Method POST http://localhost:8000/schemas `
  -Headers @{"Content-Type"="application/json"} `
  -Body $body

# GET /schemas/{id}
curl http://localhost:8000/schemas/1

# DELETE /schemas/{id}
curl -Method DELETE http://localhost:8000/schemas/1
```

### Test Records API
```powershell
# POST /records
$body = @{
    schema_id=1
    user="john"
    data=@{revenue=5000; units=100}
} | ConvertTo-Json

curl -Method POST http://localhost:8000/records `
  -Headers @{"Content-Type"="application/json"} `
  -Body $body

# GET /records?schema_id=1
curl http://localhost:8000/records?schema_id=1
```

### Test Targets API
```powershell
# POST /targets
$startDate = [int][double]::Parse((Get-Date -AsUTC -UFormat %s).Split('.')[0])
$endDate = $startDate + 604800  # 7 days

$body = @{
    schema_id=1
    user="john"
    metric_key="revenue"
    period_start=$startDate
    period_end=$endDate
    target_value=5000
} | ConvertTo-Json

curl -Method POST http://localhost:8000/targets `
  -Headers @{"Content-Type"="application/json"} `
  -Body $body

# GET /targets?schema_id=1
curl http://localhost:8000/targets?schema_id=1
```

### Test Reports API
```powershell
# GET /reports/progress
$today = [int][double]::Parse((Get-Date -AsUTC -UFormat %s).Split('.')[0])
$params = "?schema_id=1&metric_key=revenue&period=weekly&start=$today"

curl "http://localhost:8000/reports/progress$params"
```

---

## Troubleshooting

### Issue: "Failed to connect to backend"
**Solution:** 
- Verify backend is running: `curl http://localhost:8000/health`
- Check port 8000 is not blocked
- Restart backend: `uvicorn main:app --reload --port 8000`

### Issue: "Module not found" in backend
**Solution:**
```powershell
cd backend
.\.venv\Scripts\Activate
pip install -r requirements.txt
```

### Issue: "npm ERR!" in frontend
**Solution:**
```powershell
cd frontend
rm -r node_modules package-lock.json
npm install
npm run dev
```

### Issue: "CORS error" in browser console
**Solution:**
- Backend CORS is configured for http://localhost:5173
- Check frontend is running on 5173
- Restart backend and frontend

### Issue: "Schema not found" in dashboard
**Solution:**
- Create a schema first in Field Builder
- Submit at least one record
- Refresh page and try again

---

## Data Verification

### Check Database

```powershell
# View database file
ls backend/reporting.db

# If SQLite CLI installed:
sqlite3 backend/reporting.db
  
# In SQLite:
.tables
SELECT * FROM fieldschema;
SELECT * FROM record;
SELECT * FROM target;
```

### View Browser Console

1. Open browser DevTools: F12
2. Go to Console tab
3. Check for errors (red messages)
4. Check Network tab for API calls

---

## API Response Examples

### Create Schema Response
```json
{
  "id": 1,
  "name": "Sales Metrics",
  "json_schema": {
    "type": "object",
    "properties": {
      "revenue": {"type": "number"},
      "units": {"type": "number"}
    }
  }
}
```

### Create Record Response
```json
{
  "id": 1,
  "schema_id": 1,
  "user": "john",
  "timestamp": 1704067200,
  "data": {
    "revenue": 5000,
    "units": 100
  }
}
```

### Create Target Response
```json
{
  "id": 1,
  "schema_id": 1,
  "user": "john",
  "metric_key": "revenue",
  "period_start": 1704067200,
  "period_end": 1704499200,
  "target_value": 5000
}
```

### Progress Report Response
```json
{
  "period_start": 1704067200,
  "period_end": 1704499200,
  "metric_key": "revenue",
  "results": [
    {
      "user": "john",
      "actual": 5000,
      "target": 5000,
      "percent": 100.0
    },
    {
      "user": "jane",
      "actual": 4500,
      "target": 5000,
      "percent": 90.0
    }
  ]
}
```

---

## Feature Summary

| Feature | Tab | API Endpoint | Status |
|---------|-----|--------------|--------|
| Create Schemas | Field Builder | POST /schemas | ✅ |
| List Schemas | All | GET /schemas | ✅ |
| Load Schema | Field Builder, Report | GET /schemas/{id} | ✅ |
| Submit Records | Report | POST /records | ✅ |
| View Records | Report | GET /records | ✅ |
| Create Targets | Targets | POST /targets | ✅ |
| List Targets | Targets | GET /targets | ✅ |
| View Progress | Dashboard | GET /reports/progress | ✅ |
| Export CSV | Report | Client-side | ✅ |
| Export PDF | Report | Client-side | ✅ |

---

## Next Steps

1. ✅ Start backend (Terminal 1)
2. ✅ Start frontend (Terminal 2)
3. ✅ Open http://localhost:5173/
4. ✅ Follow workflow test in Step 4
5. ✅ Verify all 4 tabs work
6. ✅ Check API endpoints with curl commands

**Total Setup Time:** ~5 minutes

---

## Need Help?

Check these files:
- `README.md` - Overview and features
- `TESTING.md` - Detailed testing procedures
- `API_UI_MAPPING.md` - Complete API-UI mapping
- `backend/ARCHITECTURE.md` - Backend structure
- `frontend/ARCHITECTURE.md` - Frontend structure

