# Backend Architecture - MVC Pattern

## Project Structure

```
backend/
├── main.py               # FastAPI app initialization and routing
├── requirements.txt      # Python dependencies
├── reporting.db          # SQLite database (created on startup)
├── models.py             # Data layer - ORM models (Model)
│   ├── FieldSchema       # Schema definition storage
│   ├── Record            # Form submission records
│   └── Target            # Target/goal definitions
├── services/             # Business logic layer (Controller)
│   ├── schema_service.py       # Schema operations
│   ├── record_service.py       # Record operations with validation
│   ├── target_service.py       # Target operations
│   └── report_service.py       # Report aggregation and analysis
└── routes/               # Endpoint handlers (View/API Layer)
    ├── schemas.py              # Schema endpoints
    ├── records.py              # Record endpoints
    ├── targets.py              # Target endpoints
    └── reports.py              # Report endpoints
```

## MVC Layers

### Model (Data Layer)
- **models.py**: SQLModel ORM definitions
  - `FieldSchema`: Stores dynamic form schema as JSON
  - `Record`: Stores submitted form data
  - `Target`: Stores goal/target for metrics
  
- SQLite database with automatic schema creation on startup
- Type-safe database operations using SQLModel

### Controller (Business Logic Layer)
- **services/**: Static service classes with pure business logic
  - `SchemaService`: Schema CRUD, listing
  - `RecordService`: Record CRUD, JSON Schema validation
  - `TargetService`: Target CRUD, filtering
  - `ReportService`: Weekly/monthly aggregation, progress calculation

- Key features:
  - Pure functions (static methods)
  - No side effects
  - Comprehensive error handling
  - Validation of inputs

### View (API Layer)
- **routes/**: FastAPI APIRouter modules
  - Each router handles one entity type
  - Calls service layer for business logic
  - Handles HTTP request/response
  - Error responses (400, 404, 500)

- Endpoints:
  - `GET /schemas` - List all schemas
  - `POST /schemas` - Create schema
  - `GET /schemas/{id}` - Get single schema
  - `GET /records?schema_id=...` - List records
  - `POST /records` - Create record with validation
  - `POST /targets` - Create target
  - `GET /targets?schema_id=...` - List targets
  - `GET /reports/progress?schema_id=...&metric_key=...&period=weekly|monthly` - Get progress report

## Service Layer Details

### SchemaService
- `list_schemas(session)` - List all schemas with parsed JSON
- `create_schema(session, name, json_schema)` - Create and validate
- `get_schema(session, schema_id)` - Fetch by ID
- `update_schema(session, schema_id, name, json_schema)` - Update
- `delete_schema(session, schema_id)` - Delete

### RecordService
- `list_records(session, schema_id=None)` - List with optional filtering
- `create_record(session, schema_id, user, data)` - Create with JSON Schema validation
- `get_record(session, record_id)` - Fetch by ID
- `delete_record(session, record_id)` - Delete

### TargetService
- `create_target(session, schema_id, user, metric_key, period_start, period_end, target_value)` - Create
- `list_targets(session, schema_id=None, user=None)` - List with filtering
- `get_target(session, target_id)` - Fetch by ID
- `update_target(session, target_id, target_value, period_start, period_end)` - Partial update
- `delete_target(session, target_id)` - Delete

### ReportService
- `get_progress_report(session, schema_id, metric_key, period, user=None, start=None, end=None)`
  - Calculates weekly or monthly progress
  - Sums metric values per user
  - Matches targets by period overlap
  - Returns: {period_start, period_end, metric_key, results: [{user, actual, target, percent}]}

## Key Design Principles

### ✅ Separation of Concerns
- Models: Only data definitions
- Services: Only business logic
- Routes: Only HTTP handling

### ✅ Validation
- JSON Schema validation on record submission
- Input validation in service layer
- Schema constraints enforced at database level

### ✅ Error Handling
- Try/catch in service layer
- HTTPException raised for API errors
- Descriptive error messages

### ✅ Database Sessions
- Each route creates a session
- Sessions passed to services
- Automatic commit/rollback

### ✅ Type Safety
- SQLModel ensures type checking
- Pydantic models for request validation
- Optional/required field handling

## Testing Endpoints

Start backend:
```bash
cd backend
python -m venv .venv
.venv\Scripts\Activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Test health:
```bash
curl http://localhost:8000/health
```

Create schema:
```bash
curl -X POST http://localhost:8000/schemas \
  -H "Content-Type: application/json" \
  -d '{"name": "Sales", "json_schema": {"type": "object", "properties": {"revenue": {"type": "number"}}}}'
```

## Future Enhancements

- Add authentication middleware
- Add rate limiting
- Add request logging
- Add database migration system (Alembic)
- Add comprehensive error logging
- Add input sanitization
- Add request/response caching
