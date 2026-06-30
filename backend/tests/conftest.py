"""Pytest fixtures for the BlueBolt backend API tests.

Every test session runs against a fresh, throwaway SQLite database created in a
temp directory (via the BLUEBOLT_DB env var, read in database.py) so the real
bluebolt.db is never touched. The app's startup hook seeds the standard demo
data, so tests can rely on PODs/members/ideas/etc. being present.
"""
import os
import sys
import tempfile

import pytest

# Make the backend package importable when pytest is run from the repo root.
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

# Point the app at an isolated DB BEFORE importing anything that builds the
# engine. This file/dir lives only for the duration of the test session.
_TMP_DIR = tempfile.mkdtemp(prefix='bluebolt_test_')
os.environ['BLUEBOLT_DB'] = os.path.join(_TMP_DIR, 'test.db')

from fastapi.testclient import TestClient  # noqa: E402
from main import app  # noqa: E402


@pytest.fixture(scope='session')
def client():
    # The context manager triggers FastAPI startup (init_db -> seed demo data).
    with TestClient(app) as c:
        yield c
