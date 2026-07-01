from fastapi import APIRouter, HTTPException

from services import test_service

router = APIRouter(prefix='/api/tests', tags=['tests'])

_VALID = {'all', 'backend', 'frontend'}


@router.get('/report')
def latest_report():
    """Return the last cached test report (instant; no test run)."""
    return test_service.load_report()


@router.post('/run')
def run_tests(suite: str = 'all'):
    """Run the requested suite(s) and return structured results. Slow — the
    client must use a long timeout."""
    if suite not in _VALID:
        raise HTTPException(status_code=400, detail='suite must be all, backend or frontend')
    return test_service.run(suite)
