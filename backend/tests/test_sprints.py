"""Tests for the sprint tracker module."""

MEMBER = '2012144'  # seeded member


def test_list_sprints(client):
    r = client.get('/api/sprints')
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_upsert_creates_then_updates(client):
    sp = "UT'99"
    r = client.post('/api/sprints', json={
        'member': MEMBER, 'sprint': sp, 'committed': 10, 'completed': 5,
        'targetIdeas': 1, 'comments': 'first',
    })
    assert r.status_code == 200
    assert r.json()['committed'] == 10
    assert r.json()['member_id'] == MEMBER

    # Same (member, sprint) updates in place.
    r = client.post('/api/sprints', json={
        'member': MEMBER, 'sprint': sp, 'committed': 20, 'completed': 18,
        'targetIdeas': 2, 'comments': 'second',
    })
    assert r.status_code == 200
    assert r.json()['committed'] == 20
    assert r.json()['comments'] == 'second'

    # cleanup
    r = client.delete('/api/sprints', params={'member': MEMBER, 'sprint': sp})
    assert r.status_code == 200


def test_upsert_unknown_member_rejected(client):
    r = client.post('/api/sprints', json={'member': '000000', 'sprint': "X'01"})
    assert r.status_code == 400
    assert 'Unknown member' in r.json()['error']


def test_upsert_requires_member_and_sprint(client):
    assert client.post('/api/sprints', json={'member': '', 'sprint': "X'01"}).status_code == 400
    assert client.post('/api/sprints', json={'member': MEMBER, 'sprint': ''}).status_code == 400


def test_delete_missing_sprint_404(client):
    r = client.delete('/api/sprints', params={'member': MEMBER, 'sprint': "DOESNOTEXIST'00"})
    assert r.status_code == 404


def test_rename_and_delete_by_name(client):
    old, new = "REN'01", "REN'02"
    client.post('/api/sprints', json={'member': MEMBER, 'sprint': old, 'committed': 3})
    r = client.put('/api/sprints/rename', json={'old': old, 'new': new})
    assert r.status_code == 200
    assert r.json()['moved'] == 1

    # Now delete the whole renamed period.
    r = client.delete('/api/sprints/by-name', params={'sprint': new})
    assert r.status_code == 200
    assert r.json()['deleted'] == 1


def test_rename_missing_sprint_404(client):
    r = client.put('/api/sprints/rename', json={'old': "GHOST'00", 'new': "X'00"})
    assert r.status_code == 404
