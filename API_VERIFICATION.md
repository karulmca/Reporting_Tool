# API Endpoint Verification & Testing Guide

Complete guide to verify all API endpoints are correctly mapped and functional.

---

## Part 1: Pre-Launch Verification

### Checklist: Backend Ready

```powershell
# 1. Check main.py has all routes
Get-Content backend/main.py | grep "include_router"
# Should show: 4 lines (schemas, records, targets, reports)

# 2. Check routes exist
Test-Path backend/routes/schemas.py
Test-Path backend/routes/records.py
Test-Path backend/routes/targets.py
Test-Path backend/routes/reports.py

# 3. Check services exist
Test-Path backend/services/schema_service.py
Test-Path backend/services/record_service.py
Test-Path backend/services/target_service.py
Test-Path backend/services/report_service.py

# 4. Check requirements.txt has dependencies
Get-Content backend/requirements.txt
# Should include: fastapi, uvicorn, sqlmodel, sqlalchemy, jsonschema
```

### Checklist: Frontend Ready

```powershell
# 1. Check App.jsx has all tabs
Get-Content frontend/src/App.jsx | grep "Tab label"
# Should show: 4 tabs (Field Builder, Report, Targets, Dashboard)

# 2. Check components exist
Test-Path frontend/src/components/Auth.jsx
Test-Path frontend/src/components/FieldBuilder.jsx
Test-Path frontend/src/components/ReportScreen.jsx
Test-Path frontend/src/components/TargetManager.jsx
Test-Path frontend/src/components/Dashboard.jsx

# 3. Check hooks exist
Test-Path frontend/src/hooks/useSchemaService.js
Test-Path frontend/src/hooks/useRecordService.js
Test-Path frontend/src/hooks/useTargetService.js
Test-Path frontend/src/hooks/useReportService.js

# 4. Check utilities exist
Test-Path frontend/src/utils/dateUtils.js
Test-Path frontend/src/utils/validation.js

# 5. Check package.json has dependencies
Get-Content frontend/package.json
# Should include: react, @mui/material, @rjsf/core, recharts
```

---

## Part 2: Backend Startup Verification

### Start Backend
```powershell
cd backend
.\.venv\Scripts\Activate
uvicorn main:app --reload --port 8000
```

### Expected Output
```
INFO:     Uvicorn running on http://127.0.0.1:8000
INFO:     Application startup complete
INFO:     Started server process [12345]
```

### Verify Backend is Running
```powershell
# Test health endpoint
curl http://localhost:8000/health -Headers @{"Content-Type"="application/json"}

# Expected Response: {"status":"ok"}
```

### Verify CORS Configuration
```powershell
# Check backend accepts requests from frontend origin
curl -i http://localhost:8000/health `
  -Headers @{"Origin"="http://localhost:5173"}

# Look for in response headers:
# access-control-allow-origin: http://localhost:5173
```

---

## Part 3: Frontend Startup Verification

### Start Frontend
```powershell
cd frontend
npm install  # if needed
npm run dev
```

### Expected Output
```
VITE v5.0.0  ready in 234 ms

➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
➜  press h to show help
```

### Verify Frontend Access
```powershell
# Open browser and go to http://localhost:5173/
# You should see:
# 1. Auth screen with login form
# 2. Input field for name
# 3. "Sign In" button
```

---

## Part 4: Individual API Endpoint Testing

### 1. Schema Endpoints

#### List Schemas (GET /schemas)
```powershell
# Expected: Returns array of schemas

curl http://localhost:8000/schemas

# Response: [{"id":1,"name":"Sales Metrics","json_schema":{...}}, ...]
```

#### Create Schema (POST /schemas)
```powershell
$schema = @{
    type = "object"
    properties = @{
        revenue = @{type = "number"}
        units = @{type = "number"}
    }
} | ConvertTo-Json -Depth 10

$body = @{
    name = "Sales Metrics"
    json_schema = $schema
} | ConvertTo-Json -Depth 10

curl -Method POST http://localhost:8000/schemas `
  -Headers @{"Content-Type"="application/json"} `
  -Body $body

# Response: {"id":1,"name":"Sales Metrics",...}
```

#### Get Schema (GET /schemas/{id})
```powershell
curl http://localhost:8000/schemas/1

# Response: {"id":1,"name":"Sales Metrics","json_schema":{...}}
```

#### Update Schema (PUT /schemas/{id})
```powershell
$body = @{
    name = "Updated Metrics"
    json_schema = @{
        type = "object"
        properties = @{
            sales = @{type = "number"}
        }
    }
} | ConvertTo-Json -Depth 10

curl -Method PUT http://localhost:8000/schemas/1 `
  -Headers @{"Content-Type"="application/json"} `
  -Body $body

# Response: {"id":1,"name":"Updated Metrics",...}
```

#### Delete Schema (DELETE /schemas/{id})
```powershell
curl -Method DELETE http://localhost:8000/schemas/1

# Response: {"id":1,"name":"Updated Metrics",...}

# Verify it's deleted:
curl http://localhost:8000/schemas/1
# Should return: {"detail":"schema not found"}
```

---

### 2. Record Endpoints

#### Create Record (POST /records)
```powershell
# First, create a schema if you don't have one
# Then use its ID in schema_id below

$body = @{
    schema_id = 1
    user = "john"
    data = @{
        revenue = 5000
        units = 100
    }
} | ConvertTo-Json -Depth 10

curl -Method POST http://localhost:8000/records `
  -Headers @{"Content-Type"="application/json"} `
  -Body $body

# Response: {"id":1,"schema_id":1,"user":"john","timestamp":1704067200,"data":{...}}
```

#### List Records (GET /records)
```powershell
# List all records
curl http://localhost:8000/records

# Response: [{"id":1,"schema_id":1,...}, {"id":2,"schema_id":1,...}]

# List by schema
curl "http://localhost:8000/records?schema_id=1"

# Response: [{"id":1,"schema_id":1,...}]
```

#### Get Record (GET /records/{id})
```powershell
curl http://localhost:8000/records/1

# Response: {"id":1,"schema_id":1,"user":"john",...}
```

#### Delete Record (DELETE /records/{id})
```powershell
curl -Method DELETE http://localhost:8000/records/1

# Response: {"id":1,...}

# Verify deleted:
curl http://localhost:8000/records/1
# Should return: {"detail":"record not found"}
```

---

### 3. Target Endpoints

#### Create Target (POST /targets)
```powershell
# Calculate timestamps (Unix seconds)
$today = [int][double]::Parse((Get-Date -AsUTC -UFormat %s).Split('.')[0])
$nextWeek = $today + 604800

$body = @{
    schema_id = 1
    user = "john"
    metric_key = "revenue"
    period_start = $today
    period_end = $nextWeek
    target_value = 5000
} | ConvertTo-Json

curl -Method POST http://localhost:8000/targets `
  -Headers @{"Content-Type"="application/json"} `
  -Body $body

# Response: {"id":1,"schema_id":1,"user":"john","metric_key":"revenue",...}
```

#### List Targets (GET /targets)
```powershell
# List all targets
curl http://localhost:8000/targets

# Response: [{"id":1,...}, {"id":2,...}]

# List by schema
curl "http://localhost:8000/targets?schema_id=1"

# Response: [{"id":1,"schema_id":1,...}]

# List by user
curl "http://localhost:8000/targets?user=john"

# Response: [{"id":1,"user":"john",...}]

# Combined filter
curl "http://localhost:8000/targets?schema_id=1&user=john"
```

#### Get Target (GET /targets/{id})
```powershell
curl http://localhost:8000/targets/1

# Response: {"id":1,"schema_id":1,"user":"john",...}
```

#### Update Target (PUT /targets/{id})
```powershell
$body = @{
    target_value = 6000
} | ConvertTo-Json

curl -Method PUT http://localhost:8000/targets/1 `
  -Headers @{"Content-Type"="application/json"} `
  -Body $body

# Response: {"id":1,"schema_id":1,"target_value":6000,...}
```

#### Delete Target (DELETE /targets/{id})
```powershell
curl -Method DELETE http://localhost:8000/targets/1

# Response: {"id":1,...}
```

---

### 4. Report Endpoint

#### Get Progress Report (GET /reports/progress)
```powershell
# Basic weekly report
curl "http://localhost:8000/reports/progress?schema_id=1&metric_key=revenue&period=weekly"

# Response:
# {
#   "period_start": 1704067200,
#   "period_end": 1704499200,
#   "metric_key": "revenue",
#   "results": [
#     {"user": "john", "actual": 5000, "target": 5000, "percent": 100.0},
#     {"user": "jane", "actual": 4500, "target": 5000, "percent": 90.0}
#   ]
# }

# Monthly report
curl "http://localhost:8000/reports/progress?schema_id=1&metric_key=revenue&period=monthly"

# With user filter
curl "http://localhost:8000/reports/progress?schema_id=1&metric_key=revenue&period=weekly&user=john"

# With custom date range (Unix timestamps)
$start = [int][double]::Parse((Get-Date -AsUTC -UFormat %s).Split('.')[0])
$end = $start + 604800

curl "http://localhost:8000/reports/progress?schema_id=1&metric_key=revenue&period=weekly&start=$start&end=$end"
```

---

## Part 5: Frontend-to-Backend Integration Testing

### Step 1: Authentication
```javascript
// Browser Console (F12)

// Check if auth works
localStorage.getItem('user')
// Should show: {"id":"...","name":"John"}
```

### Step 2: Field Builder Integration
```javascript
// 1. Open Field Builder tab
// 2. Check Network tab (F12) for:
//    - GET /schemas (list all schemas)
// 3. Create a field and save
// 4. Check Network tab for:
//    - POST /schemas (create new schema)
// 5. Load schema from dropdown
// 6. Check Network tab for:
//    - GET /schemas/{id} (load schema)
```

### Step 3: Report Screen Integration
```javascript
// 1. Open Report tab
// 2. Check Network tab for:
//    - GET /schemas (populate dropdown)
// 3. Select schema and load
// 4. Check Network tab for:
//    - GET /schemas/{id} (get schema structure)
// 5. Fill form and submit
// 6. Check Network tab for:
//    - POST /records (submit form)
// 7. Verify record appears in table
// 8. Check Network tab for:
//    - GET /records?schema_id=... (fetch records)
```

### Step 4: Target Manager Integration
```javascript
// 1. Open Targets tab
// 2. Check Network tab for:
//    - GET /schemas (populate dropdown)
// 3. Select schema
// 4. Check Network tab for:
//    - GET /targets?schema_id=... (fetch targets)
// 5. Click "Create Target"
// 6. Fill and submit form
// 7. Check Network tab for:
//    - POST /targets (create target)
// 8. Verify table refreshes
```

### Step 5: Dashboard Integration
```javascript
// 1. Open Dashboard tab
// 2. Check Network tab for:
//    - GET /schemas (populate dropdown)
// 3. Select schema
// 4. Check Network tab for:
//    - GET /schemas/{id} (populate metrics)
// 5. Select metric and period
// 6. Click "Generate Report"
// 7. Check Network tab for:
//    - GET /reports/progress?... (fetch report)
// 8. Verify chart and table render
```

---

## Part 6: Complete End-to-End Test

### Test Scenario: Sales Team Productivity Tracking

#### Step 1: Create Schema
1. Open **Field Builder** tab
2. Add fields:
   - Revenue (type: Number)
   - Units Sold (type: Number)
   - Calls Made (type: Number)
3. Save as "Q1 Sales Metrics"
4. ✅ Verify in GET /schemas

#### Step 2: Submit Records
1. Open **Report** tab
2. Load "Q1 Sales Metrics"
3. Submit 2-3 records:
   - Record 1: Revenue: 5000, Units: 100, Calls: 50
   - Record 2: Revenue: 4500, Units: 95, Calls: 48
4. ✅ Verify records appear in list
5. ✅ Verify in GET /records?schema_id=X

#### Step 3: Create Targets
1. Open **Targets** tab
2. Select "Q1 Sales Metrics"
3. Create targets:
   - Metric: revenue, Target: 5000, Period: This week
   - Metric: units, Target: 100, Period: This week
4. ✅ Verify in GET /targets?schema_id=X

#### Step 4: View Dashboard
1. Open **Dashboard** tab
2. Select "Q1 Sales Metrics"
3. Select "revenue" metric
4. Keep "Weekly" period
5. Click "Generate Report"
6. ✅ See chart: actual vs target for each user
7. ✅ See table with % complete

#### Expected Results
- Schema created and saved ✅
- Records submitted and stored ✅
- Targets created and stored ✅
- Report generated with correct calculations ✅
- Chart displays actual vs target ✅
- Progress % calculated correctly ✅

---

## Part 7: Error Handling Verification

### Test Invalid Inputs

#### Invalid Schema
```powershell
# Missing required field
$body = @{
    name = "Test"
    # Missing json_schema
} | ConvertTo-Json

curl -Method POST http://localhost:8000/schemas `
  -Headers @{"Content-Type"="application/json"} `
  -Body $body

# Should return: 422 Unprocessable Entity
```

#### Invalid Record Data
```powershell
# Record data doesn't match schema
$body = @{
    schema_id = 1
    user = "john"
    data = @{
        invalid_field = "value"  # Field not in schema
    }
} | ConvertTo-Json

curl -Method POST http://localhost:8000/records `
  -Headers @{"Content-Type"="application/json"} `
  -Body $body

# Should return: 400 Bad Request with validation error
```

#### Invalid Target
```powershell
# period_start >= period_end
$today = [int][double]::Parse((Get-Date -AsUTC -UFormat %s).Split('.')[0])

$body = @{
    schema_id = 1
    user = "john"
    metric_key = "revenue"
    period_start = $today + 604800  # Start is later than end
    period_end = $today
    target_value = 5000
} | ConvertTo-Json

curl -Method POST http://localhost:8000/targets `
  -Headers @{"Content-Type"="application/json"} `
  -Body $body

# Should return: 400 Bad Request with period validation error
```

#### Not Found Errors
```powershell
# Get non-existent schema
curl http://localhost:8000/schemas/99999

# Should return: 404 Not Found

# Get non-existent record
curl http://localhost:8000/records/99999

# Should return: 404 Not Found
```

---

## Part 8: Performance Verification

### Load Testing

```powershell
# Create 100 records and measure response time
$sw = [System.Diagnostics.Stopwatch]::StartNew()

for ($i = 1; $i -le 100; $i++) {
    $body = @{
        schema_id = 1
        user = "user$i"
        data = @{
            revenue = Get-Random -Minimum 1000 -Maximum 10000
            units = Get-Random -Minimum 10 -Maximum 100
        }
    } | ConvertTo-Json

    curl -Method POST http://localhost:8000/records `
      -Headers @{"Content-Type"="application/json"} `
      -Body $body -OutFile $null
}

$sw.Stop()
Write-Host "Created 100 records in $($sw.ElapsedMilliseconds) ms"

# List all records - should still be fast
$sw.Restart()
curl http://localhost:8000/records -OutFile $null
$sw.Stop()
Write-Host "Listed all records in $($sw.ElapsedMilliseconds) ms"

# Generate report - should aggregate efficiently
$sw.Restart()
curl "http://localhost:8000/reports/progress?schema_id=1&metric_key=revenue&period=weekly" `
  -OutFile $null
$sw.Stop()
Write-Host "Generated report in $($sw.ElapsedMilliseconds) ms"
```

---

## Part 9: Troubleshooting

### Issue: Frontend can't connect to backend
```powershell
# Verify backend is running on 8000
netstat -ano | grep 8000

# If not showing, restart:
cd backend
.\.venv\Scripts\Activate
uvicorn main:app --reload --port 8000
```

### Issue: CORS error
```
Access to XMLHttpRequest at 'http://localhost:8000/...' 
from origin 'http://localhost:5173' has been blocked by CORS policy
```

**Solution:**
- Check backend CORS config allows origin: http://localhost:5173
- Verify CORS headers in response
- Restart both backend and frontend

### Issue: "Module not found" in backend
```powershell
cd backend
.\.venv\Scripts\Activate
pip install fastapi uvicorn sqlmodel jsonschema
```

### Issue: "npm ERR!" in frontend
```powershell
cd frontend
npm install
```

### Issue: Schema not found in UI
```powershell
# Verify database has schemas
sqlite3 backend/reporting.db "SELECT * FROM fieldschema;"

# If empty, create one via API first
```

---

## Verification Checklist

- [ ] Backend starts without errors
- [ ] Health endpoint returns {"status":"ok"}
- [ ] CORS allows http://localhost:5173
- [ ] Frontend starts without errors
- [ ] Login works with any name
- [ ] Field Builder: Can create and save schemas
- [ ] Report: Can submit and view records
- [ ] Targets: Can create and list targets
- [ ] Dashboard: Can generate progress reports
- [ ] Charts render correctly
- [ ] Tables display data properly
- [ ] All API endpoints respond correctly
- [ ] Error handling shows meaningful messages
- [ ] Data persists across page refresh
- [ ] No console errors (F12 DevTools)

---

## Quick Verification Commands

```powershell
# All-in-one verification script
Write-Host "=== Verification Start ===" 

# 1. Health check
Write-Host "1. Health check..."
curl http://localhost:8000/health

# 2. List schemas
Write-Host "2. List schemas..."
curl http://localhost:8000/schemas

# 3. List records
Write-Host "3. List records..."
curl http://localhost:8000/records

# 4. List targets
Write-Host "4. List targets..."
curl http://localhost:8000/targets

# 5. Check frontend
Write-Host "5. Frontend is running at: http://localhost:5173/"

Write-Host "=== All systems operational ==="
```

