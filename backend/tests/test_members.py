"""Tests for the members module."""


def test_list_members_seeded(client):
    r = client.get('/api/members')
    assert r.status_code == 200
    ids = {m['id'] for m in r.json()}
    assert '2012144' in ids


def test_create_update_delete_member(client):
    r = client.post('/api/members', json={
        'id': 'T100', 'name': 'Test User', 'pod': 'BE', 'target': 9,
        'custom': {'note': 'hi'},
    })
    assert r.status_code == 200
    body = r.json()
    assert body['id'] == 'T100'
    assert body['target'] == 9
    assert body['custom'] == {'note': 'hi'}

    r = client.put('/api/members/T100', json={'name': 'Renamed', 'target': 15})
    assert r.status_code == 200
    assert r.json()['name'] == 'Renamed'
    assert r.json()['target'] == 15

    r = client.delete('/api/members/T100')
    assert r.status_code == 200
    assert r.json() == {'ok': True}


def test_create_member_requires_id_and_name(client):
    assert client.post('/api/members', json={'id': '', 'name': 'x'}).status_code == 400
    assert client.post('/api/members', json={'id': 'X1', 'name': ''}).status_code == 400


def test_create_duplicate_member_rejected(client):
    client.post('/api/members', json={'id': 'T200', 'name': 'Dup'})
    r = client.post('/api/members', json={'id': 'T200', 'name': 'Dup'})
    assert r.status_code == 400
    client.delete('/api/members/T200')


def test_update_missing_member_404(client):
    assert client.put('/api/members/ZZZ', json={'name': 'x'}).status_code == 404


def test_delete_missing_member_404(client):
    assert client.delete('/api/members/ZZZ').status_code == 404


def test_bulk_members(client):
    rows = [
        {'id': 'B1', 'name': 'Bulk One', 'pod': 'FE'},
        {'id': 'B2', 'name': 'Bulk Two', 'pod': 'BE'},
        {'id': '', 'name': 'No id'},               # error row
        {'id': 'B3', 'name': 'Bad pod', 'pod': 'ZZ'},  # unknown pod row
    ]
    r = client.post('/api/members/bulk', json={'rows': rows})
    assert r.status_code == 200
    res = r.json()
    assert res['created'] == 2
    assert res['total'] == 4
    assert len(res['errors']) == 2
    client.delete('/api/members/B1')
    client.delete('/api/members/B2')
