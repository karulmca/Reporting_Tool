"""Tests for the /api/tests report+run endpoints.

The runner is monkeypatched so we never recursively invoke pytest/vitest.
"""
import services.test_service as test_service


SAMPLE = {
    'suites': [
        {'name': 'backend', 'framework': 'pytest', 'passed': 2, 'failed': 0,
         'skipped': 0, 'total': 2, 'duration': 0.5, 'success': True, 'cases': [], 'ran_at': 'now'},
    ],
    'generated_at': 'now',
}


def test_get_report(client, monkeypatch):
    monkeypatch.setattr(test_service, 'load_report', lambda: SAMPLE)
    r = client.get('/api/tests/report')
    assert r.status_code == 200
    assert r.json()['suites'][0]['name'] == 'backend'


def test_run_invalid_suite_rejected(client):
    assert client.post('/api/tests/run?suite=bogus').status_code == 400


def test_run_backend_suite(client, monkeypatch):
    called = {}

    def fake_run(suite='all'):
        called['suite'] = suite
        return SAMPLE

    monkeypatch.setattr(test_service, 'run', fake_run)
    r = client.post('/api/tests/run?suite=backend')
    assert r.status_code == 200
    assert called['suite'] == 'backend'
    assert r.json()['suites'][0]['passed'] == 2


def test_parse_vitest_shape(tmp_path):
    # Feed the Jest-compatible JSON shape and check normalization.
    import json
    p = tmp_path / 'fe.json'
    p.write_text(json.dumps({
        'numTotalTests': 2, 'numPassedTests': 1, 'numFailedTests': 1,
        'numPendingTests': 0, 'numTodoTests': 0,
        'testResults': [{
            'name': '/x/helpers.test.js',
            'assertionResults': [
                {'fullName': 'a passes', 'title': 'passes', 'status': 'passed', 'duration': 5, 'failureMessages': []},
                {'fullName': 'b fails', 'title': 'fails', 'status': 'failed', 'duration': 3, 'failureMessages': ['boom']},
            ],
        }],
    }))
    out = test_service._parse_vitest(str(p))
    assert out['total'] == 2 and out['passed'] == 1 and out['failed'] == 1
    assert out['cases'][0]['suite'] == 'helpers.test.js'
    assert out['cases'][1]['message'] == 'boom'
