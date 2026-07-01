"""Run the project's automated test suites and return structured results.

Backend tests (pytest) run live via the same Python interpreter. Frontend tests
(Vitest) are run via Node when available, and otherwise read from the last JSON
report Vitest wrote (frontend/test-results/frontend.json). The combined result
is cached to .test_report.json so the UI can show the last run instantly.
"""
from __future__ import annotations

import os
import json
import shutil
import sys
import subprocess
import tempfile
import xml.etree.ElementTree as ET
from datetime import datetime

import database

BACKEND_DIR = database.BASE_DIR
ROOT_DIR = os.path.dirname(BACKEND_DIR)
FRONTEND_DIR = os.path.join(ROOT_DIR, 'frontend')
CACHE_FILE = os.path.join(BACKEND_DIR, '.test_report.json')
FRONTEND_REPORT = os.path.join(FRONTEND_DIR, 'test-results', 'frontend.json')


def _now():
    return datetime.now().strftime('%Y-%m-%d %H:%M:%S')


# --------------------------------------------------------------------------- #
# Backend: pytest -> JUnit XML
# --------------------------------------------------------------------------- #
def run_pytest() -> dict:
    xml_path = os.path.join(tempfile.mkdtemp(prefix='pytest_'), 'report.xml')
    try:
        proc = subprocess.run(
            [sys.executable, '-m', 'pytest', '--junitxml', xml_path, '-q'],
            cwd=BACKEND_DIR, capture_output=True, text=True, timeout=300,
        )
    except subprocess.TimeoutExpired:
        return _err_suite('backend', 'pytest', 'Test run timed out after 300s')
    except Exception as ex:  # pragma: no cover - environment failure
        return _err_suite('backend', 'pytest', str(ex))

    if not os.path.exists(xml_path):
        tail = (proc.stderr or proc.stdout or 'pytest produced no report')[-2000:]
        return _err_suite('backend', 'pytest', tail)
    return _parse_junit(xml_path)


def _parse_junit(xml_path: str) -> dict:
    tree = ET.parse(xml_path)
    root = tree.getroot()
    suite = root.find('testsuite') if root.tag == 'testsuites' else root
    cases = []
    passed = failed = skipped = 0
    for tc in suite.findall('testcase'):
        classname = tc.get('classname', '')
        # classname looks like "tests.test_pods"; keep the file-ish tail.
        file_part = classname.split('.')[-1] if classname else ''
        status, message = 'passed', ''
        fail = tc.find('failure')
        err = tc.find('error')
        skip = tc.find('skipped')
        if fail is not None or err is not None:
            status = 'failed'
            node = fail if fail is not None else err
            message = (node.get('message') or '') + '\n' + (node.text or '')
            failed += 1
        elif skip is not None:
            status = 'skipped'
            message = skip.get('message', '')
            skipped += 1
        else:
            passed += 1
        cases.append({
            'name': tc.get('name', ''),
            'suite': file_part,
            'status': status,
            'duration': float(tc.get('time') or 0),
            'message': message.strip(),
        })
    return {
        'name': 'backend',
        'framework': 'pytest',
        'passed': passed, 'failed': failed, 'skipped': skipped,
        'total': len(cases),
        'duration': float(suite.get('time') or 0),
        'success': failed == 0,
        'cases': cases,
        'ran_at': _now(),
    }


# --------------------------------------------------------------------------- #
# Frontend: Vitest -> JSON (Jest-compatible)
# --------------------------------------------------------------------------- #
def run_vitest() -> dict:
    node = shutil.which('node')
    entry = os.path.join(FRONTEND_DIR, 'node_modules', 'vitest', 'vitest.mjs')
    if not node or not os.path.exists(entry):
        # Fall back to the last report Vitest wrote, if any.
        report = load_frontend_report()
        if report:
            report['note'] = 'Node/Vitest not runnable here; showing last saved report.'
            return report
        return _err_suite('frontend', 'vitest', 'Node or Vitest not available on the server')

    out = os.path.join(tempfile.mkdtemp(prefix='vitest_'), 'frontend.json')
    env = dict(os.environ, NODE_ENV='development')
    try:
        subprocess.run(
            [node, entry, 'run', '--reporter=json', '--outputFile', out],
            cwd=FRONTEND_DIR, capture_output=True, text=True, timeout=300, env=env,
        )
    except subprocess.TimeoutExpired:
        return _err_suite('frontend', 'vitest', 'Test run timed out after 300s')
    except Exception as ex:  # pragma: no cover
        return _err_suite('frontend', 'vitest', str(ex))

    if not os.path.exists(out):
        return _err_suite('frontend', 'vitest', 'Vitest produced no JSON report')
    return _parse_vitest(out)


def load_frontend_report() -> dict | None:
    if not os.path.exists(FRONTEND_REPORT):
        return None
    try:
        return _parse_vitest(FRONTEND_REPORT)
    except Exception:
        return None


def _parse_vitest(path: str) -> dict:
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    cases = []
    for tr in data.get('testResults', []):
        file_name = os.path.basename(tr.get('name', ''))
        for a in tr.get('assertionResults', []):
            st = a.get('status', '')
            status = 'passed' if st == 'passed' else 'skipped' if st in ('skipped', 'pending', 'todo') else 'failed'
            cases.append({
                'name': a.get('fullName') or a.get('title', ''),
                'suite': file_name,
                'status': status,
                'duration': (a.get('duration') or 0) / 1000.0,
                'message': '\n'.join(a.get('failureMessages') or []).strip(),
            })
    total = data.get('numTotalTests', len(cases))
    failed = data.get('numFailedTests', sum(1 for c in cases if c['status'] == 'failed'))
    skipped = data.get('numPendingTests', 0) + data.get('numTodoTests', 0)
    passed = data.get('numPassedTests', total - failed - skipped)
    return {
        'name': 'frontend',
        'framework': 'vitest',
        'passed': passed, 'failed': failed, 'skipped': skipped,
        'total': total,
        'duration': max((c['duration'] for c in cases), default=0) and sum(c['duration'] for c in cases),
        'success': failed == 0 and total > 0,
        'cases': cases,
        'ran_at': _now(),
    }


def _err_suite(name, framework, message) -> dict:
    return {
        'name': name, 'framework': framework,
        'passed': 0, 'failed': 0, 'skipped': 0, 'total': 0, 'duration': 0,
        'success': False, 'cases': [], 'error': message.strip(), 'ran_at': _now(),
    }


# --------------------------------------------------------------------------- #
# Orchestration + cache
# --------------------------------------------------------------------------- #
def run(suite: str = 'all') -> dict:
    suites = []
    if suite in ('all', 'backend'):
        suites.append(run_pytest())
    if suite in ('all', 'frontend'):
        suites.append(run_vitest())

    # Merge with any previously cached suites not run this time.
    cached = load_report().get('suites', [])
    by_name = {s['name']: s for s in cached}
    for s in suites:
        by_name[s['name']] = s
    report = {'suites': list(by_name.values()), 'generated_at': _now()}
    _save_report(report)
    return report


def load_report() -> dict:
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            pass
    # No cache yet: surface the frontend report if it exists.
    fr = load_frontend_report()
    return {'suites': [fr] if fr else [], 'generated_at': None}


def _save_report(report: dict):
    try:
        with open(CACHE_FILE, 'w', encoding='utf-8') as f:
            json.dump(report, f)
    except Exception:  # pragma: no cover
        pass
