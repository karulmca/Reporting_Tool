"""Tests for the PODs/teams module."""


def test_list_pods_seeded(client):
    r = client.get('/api/pods')
    assert r.status_code == 200
    codes = {p['code'] for p in r.json()}
    assert {'FE', 'BE', 'QA'} <= codes


def test_create_update_delete_pod(client):
    # create
    r = client.post('/api/pods', json={'code': 'tst', 'name': 'Test POD', 'color': '#123456'})
    assert r.status_code == 200
    body = r.json()
    assert body['code'] == 'TST'  # code is upper-cased
    assert body['name'] == 'Test POD'

    # update
    r = client.put('/api/pods/TST', json={'name': 'Renamed POD'})
    assert r.status_code == 200
    assert r.json()['name'] == 'Renamed POD'

    # delete
    r = client.delete('/api/pods/TST')
    assert r.status_code == 200
    assert r.json() == {'ok': True}


def test_create_duplicate_pod_rejected(client):
    client.post('/api/pods', json={'code': 'DUP'})
    r = client.post('/api/pods', json={'code': 'DUP'})
    assert r.status_code == 400
    assert 'already exists' in r.json()['error']
    client.delete('/api/pods/DUP')


def test_create_pod_requires_code(client):
    r = client.post('/api/pods', json={'code': '   '})
    assert r.status_code == 400


def test_update_missing_pod_404(client):
    r = client.put('/api/pods/NOPE', json={'name': 'x'})
    assert r.status_code == 404


def test_delete_missing_pod_404(client):
    r = client.delete('/api/pods/NOPE')
    assert r.status_code == 404


def test_delete_pod_with_members_rejected(client):
    # The seeded BE pod has members, so deletion must be blocked.
    r = client.delete('/api/pods/BE')
    assert r.status_code == 400
    assert 'members' in r.json()['error']
