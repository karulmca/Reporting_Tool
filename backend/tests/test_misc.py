"""Tests for the misc module: health, audit log, and the simple DB download."""


def test_health_ok(client):
    r = client.get('/api/health')
    assert r.status_code == 200
    body = r.json()
    assert body['status'] == 'ok'
    # Demo data is seeded on startup.
    assert body['members'] >= 5
    assert body['ideas'] >= 5
    for key in ('members', 'ideas', 'sprints', 'defects'):
        assert isinstance(body[key], int)


def test_audit_returns_list(client):
    r = client.get('/api/audit')
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_audit_records_a_mutation(client):
    client.post('/api/pods', json={'code': 'AUDT', 'name': 'Audit Probe'})
    rows = client.get('/api/audit').json()
    assert any(e['entity'] == 'POD' and e['entity_id'] == 'AUDT' for e in rows)
    client.delete('/api/pods/AUDT')


def test_backup_download(client):
    r = client.get('/api/backup')
    assert r.status_code == 200
    assert r.headers['content-type'] == 'application/octet-stream'
    # SQLite files start with this magic header.
    assert r.content[:16] == b'SQLite format 3\x00'


def test_index_served(client):
    # The SPA index is served at root.
    r = client.get('/')
    assert r.status_code == 200
