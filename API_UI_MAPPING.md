# API-UI Mapping Verification

Complete mapping of all Backend API endpoints to Frontend UI components.

---

## Backend Routes Summary

| Endpoint | Method | Purpose | Status |
|----------|--------|---------|--------|
| `/health` | GET | Health check | ✅ |
| `/schemas` | GET | List all schemas | ✅ |
| `/schemas` | POST | Create new schema | ✅ |
| `/schemas/{id}` | GET | Get schema details | ✅ |
| `/schemas/{id}` | PUT | Update schema | ✅ |
| `/schemas/{id}` | DELETE | Delete schema | ✅ |
| `/records` | GET | List records (filter by schema_id) | ✅ |
| `/records` | POST | Create new record | ✅ |
| `/records/{id}` | GET | Get record details | ✅ |
| `/records/{id}` | DELETE | Delete record | ✅ |
| `/targets` | GET | List targets (filter by schema_id, user) | ✅ |
| `/targets` | POST | Create new target | ✅ |
| `/targets/{id}` | GET | Get target details | ✅ |
| `/targets/{id}` | PUT | Update target | ✅ |
| `/targets/{id}` | DELETE | Delete target | ✅ |
| `/reports/progress` | GET | Get progress report (weekly/monthly) | ✅ |

---

## Frontend Components & API Calls

### 1. Auth Component (`components/Auth.jsx`)
**Purpose:** User authentication  
**API Calls:** None (uses localStorage)  
**Features:**
- Sign-in with name
- Stores user in localStorage

---

### 2. Field Builder (`components/FieldBuilder.jsx`)
**Purpose:** Create dynamic form schemas  
**API Calls:**
- ✅ `api.listSchemas()` → GET `/schemas` (load existing schemas)
- ✅ `api.createSchema(name, json_schema)` → POST `/schemas` (save schema)
- ✅ `api.getSchema(id)` → GET `/schemas/{id}` (load schema)

**Features:**
- Add/remove form fields
- Export schema as JSON
- Download schema file
- Import schema file
- Save to server
- Load from server

---

### 3. Report Screen (`components/ReportScreen.jsx`)
**Purpose:** Submit records and view visualizations  
**API Calls:**
- ✅ `api.listSchemas()` → GET `/schemas` (populate schema dropdown)
- ✅ `api.getSchema(id)` → GET `/schemas/{id}` (load schema for form)
- ✅ `api.listRecords(schema_id)` → GET `/records?schema_id=...` (fetch records)
- ✅ `api.createRecord(schema_id, user, data)` → POST `/records` (submit form)

**Features:**
- Dynamic form rendering from schema
- Submit records to backend
- View records in table
- Export records to CSV
- Export chart to PDF
- Bar chart visualization
- Local and server storage

---

### 4. Target Manager (`components/TargetManager.jsx`) **[NEW]**
**Purpose:** Create and manage targets/goals  
**API Calls:**
- ✅ `api.listSchemas()` → GET `/schemas` (populate schema dropdown)
- ✅ `api.listTargets(schema_id)` → GET `/targets?schema_id=...` (fetch targets)
- ✅ `api.createTarget(payload)` → POST `/targets` (create target)

**Payload Structure:**
```json
{
  "schema_id": 1,
  "user": "john",
  "metric_key": "revenue",
  "period_start": 1704067200,
  "period_end": 1704499200,
  "target_value": 5000
}
```

**Features:**
- Schema selector
- Create target dialog
- Targets table with formatting
- Error handling
- Form validation

---

### 5. Dashboard (`components/Dashboard.jsx`) **[NEW]**
**Purpose:** Visualize progress against targets  
**API Calls:**
- ✅ `api.listSchemas()` → GET `/schemas` (populate schema dropdown)
- ✅ `api.getSchema(id)` → GET `/schemas/{id}` (extract metrics/fields)
- ✅ `api.reportProgress(params)` → GET `/reports/progress?...` (fetch report data)

**Query Parameters:**
```javascript
{
  schema_id: 1,          // required
  metric_key: "revenue", // required
  period: "weekly",      // 'weekly' or 'monthly'
  user: "john",          // optional, filter by user
  start: 1704067200,     // optional, Unix timestamp
  end: 1704499200        // optional, Unix timestamp
}
```

**Response Structure:**
```json
{
  "period_start": 1704067200,
  "period_end": 1704499200,
  "metric_key": "revenue",
  "results": [
    {
      "user": "john",
      "actual": 4500,
      "target": 5000,
      "percent": 90.0
    }
  ]
}
```

**Features:**
- Filter: Schema, Metric, Period (weekly/monthly), User
- Bar chart: actual vs target
- Results table with progress %
- Status color-coding (green/yellow/orange/red)
- Responsive layout

---

## Custom Hooks (Service Layer)

### `useSchemaService()` 
**File:** `hooks/useSchemaService.js`  
**Methods:**
- `listSchemas()` - calls `api.listSchemas()`
- `createSchema(name, json_schema)` - calls `api.createSchema()`
- `getSchema(id)` - calls `api.getSchema()`
- `refreshSchemas()` - calls `listSchemas()`

---

### `useRecordService()`
**File:** `hooks/useRecordService.js`  
**Methods:**
- `listRecords(schema_id)` - calls `api.listRecords()`
- `createRecord(schema_id, user, data)` - calls `api.createRecord()`
- `refreshRecords(schema_id)` - refetches records

---

### `useTargetService()`
**File:** `hooks/useTargetService.js`  
**Methods:**
- `createTarget(payload)` - calls `api.createTarget()`
- `clearError()` - clears error state

---

### `useReportService()`
**File:** `hooks/useReportService.js`  
**Methods:**
- `getProgressReport(params)` - calls `api.reportProgress()`
- `clearError()` - clears error state

---

## API Client (`api.js`)

**File:** `src/api.js`  
**Base URL:** `http://localhost:8000`

### Functions Defined:
1. ✅ `listSchemas()` - GET /schemas
2. ✅ `createSchema(name, json_schema)` - POST /schemas
3. ✅ `getSchema(id)` - GET /schemas/{id}
4. ✅ `listRecords(schema_id)` - GET /records?schema_id=...
5. ✅ `createRecord(schema_id, user, data)` - POST /records
6. ✅ `listTargets(schema_id)` - GET /targets?schema_id=...
7. ✅ `createTarget(payload)` - POST /targets
8. ✅ `reportProgress(params)` - GET /reports/progress?...

---

## Navigation Structure

**App.jsx Tabs:**
1. **Tab 0: Field Builder** → `FieldBuilder.jsx`
   - Create schemas
   - Export/Import schemas
   - Manage form fields

2. **Tab 1: Report** → `ReportScreen.jsx`
   - Submit records
   - View records
   - Export CSV/PDF
   - Bar chart visualization

3. **Tab 2: Targets** → `TargetManager.jsx`
   - Create targets
   - View targets table
   - Filter by schema

4. **Tab 3: Dashboard** → `Dashboard.jsx`
   - Filter: schema, metric, period, user
   - View progress report
   - Bar chart visualization
   - Progress table with status

---

## CORS Configuration

**Backend (`main.py`):**
```python
allow_origins=["http://localhost:5173", "http://localhost:3000"]
allow_credentials=True
allow_methods=["*"]
allow_headers=["*"]
```

✅ Allows both Vite (5173) and standard dev server (3000)

---

## Data Flow Examples

### Example 1: Create & View Schema
```
User clicks "Field Builder" (Tab 0)
  ↓
listSchemas() called → GET /schemas
  ↓
Populate server schema dropdown
  ↓
User creates fields + clicks "Save to Server"
  ↓
createSchema(name, json_schema) → POST /schemas
  ↓
Schema stored in DB
  ↓
listSchemas() refreshed
  ↓
Dropdown updated with new schema
```

### Example 2: Submit Record & View Dashboard
```
User clicks "Report" (Tab 1)
  ↓
listSchemas() → GET /schemas
  ↓
User selects schema, fills form
  ↓
createRecord(schema_id, user, data) → POST /records
  ↓
Record validated against schema and stored
  ↓
User clicks "Dashboard" (Tab 3)
  ↓
listSchemas() → GET /schemas
  ↓
User selects schema → getSchema(id) → GET /schemas/{id}
  ↓
Metric dropdown auto-populated
  ↓
User clicks "Generate Report"
  ↓
reportProgress({schema_id, metric_key, period}) → GET /reports/progress
  ↓
Backend aggregates records and matches targets
  ↓
Returns {period_start, period_end, results: [{user, actual, target, percent}]}
  ↓
BarChart rendered with actual vs target
  ↓
Table shows progress % and status badges
```

### Example 3: Create Target & Track Progress
```
User clicks "Targets" (Tab 2)
  ↓
listSchemas() → GET /schemas
  ↓
User selects schema, listTargets(schema_id) → GET /targets?schema_id=...
  ↓
Targets table displays
  ↓
User clicks "Create Target" → opens dialog
  ↓
Fills: metric_key, targetValue, period_start, period_end, user
  ↓
createTarget(payload) → POST /targets
  ↓
Target stored with matching schema_id
  ↓
listTargets() refreshed → table updated
  ↓
User later visits Dashboard
  ↓
reportProgress() calculates: actual from records, target from matching target
  ↓
Progress % = (actual / target) * 100
  ↓
Status badge colored based on % (green 100%+, yellow 75-99%, orange 50-74%, red <50%)
```

---

## Verification Checklist

- [x] Backend main.py includes all 4 routes (schemas, records, targets, reports)
- [x] Frontend api.js defines all 8 API functions
- [x] FieldBuilder calls listSchemas, createSchema, getSchema
- [x] ReportScreen calls listSchemas, getSchema, listRecords, createRecord
- [x] TargetManager calls listSchemas, listTargets, createTarget
- [x] Dashboard calls listSchemas, getSchema, reportProgress
- [x] All custom hooks properly wrapped API calls
- [x] App.jsx imports all 4 components
- [x] App.jsx has 4 tabs with correct component rendering
- [x] CORS configured for http://localhost:5173
- [x] All Material-UI imports included
- [x] Recharts imports included for charts
- [x] Date utilities for timestamp handling

---

## Database Tables

**FieldSchema:**
```sql
id (PK), name (str), schema_json (JSON)
```

**Record:**
```sql
id (PK), schema_id (FK), user (str), timestamp (int), data_json (JSON)
```

**Target:**
```sql
id (PK), schema_id (FK), user (str), metric_key (str), 
period_start (int), period_end (int), target_value (float)
```

---

## Testing Checklist

1. ✅ Backend starts without errors
2. ✅ Frontend starts without errors
3. ✅ Auth login works
4. ✅ Field Builder can create and save schemas
5. ✅ Report Screen can submit records
6. ✅ Target Manager can create targets
7. ✅ Dashboard can generate reports with charts
8. ✅ All API calls return correct responses
9. ✅ CORS allows frontend requests
10. ✅ Data persists across page refreshes

