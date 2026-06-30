"""Tests for the scrum board module: frameworks, columns, types, iterations,
work items and daily updates."""

import pytest


@pytest.fixture
def scrum(client):
    """Return the seeded Scrum framework (with its columns + types)."""
    cfg = client.get('/api/board/config').json()
    fws = cfg['frameworks']
    scrum = next(f for f in fws if f['name'] == 'Scrum')
    assert scrum['columns'] and scrum['types']
    return scrum


def test_board_config_shape(client):
    r = client.get('/api/board/config')
    assert r.status_code == 200
    body = r.json()
    assert 'frameworks' in body and 'iterations' in body
    assert len(body['frameworks']) >= 1


def test_framework_crud_and_seeded_defaults(client):
    r = client.post('/api/board/frameworks', json={'name': 'UT-Framework'})
    assert r.status_code == 200
    fid = r.json()['id']

    # A new framework is seeded with default columns + types — verify via config.
    cfg = client.get('/api/board/config').json()
    fw = next(f for f in cfg['frameworks'] if f['id'] == fid)
    assert len(fw['columns']) == 3
    assert len(fw['types']) == 3

    r = client.put('/api/board/frameworks/' + fid, json={'name': 'UT-FW2'})
    assert r.status_code == 200
    assert r.json()['name'] == 'UT-FW2'

    assert client.delete('/api/board/frameworks/' + fid).status_code == 200


def test_framework_requires_name(client):
    assert client.post('/api/board/frameworks', json={'name': '  '}).status_code == 400


def test_column_crud(client, scrum):
    r = client.post('/api/board/columns', json={
        'framework_id': scrum['id'], 'name': 'UT Column', 'wip_limit': 4, 'color': '#abcabc',
    })
    assert r.status_code == 200
    cid = r.json()['id']
    assert r.json()['wip_limit'] == 4

    r = client.put('/api/board/columns/' + cid, json={'name': 'UT Col 2', 'is_done': True})
    assert r.status_code == 200
    assert r.json()['is_done'] is True

    assert client.delete('/api/board/columns/' + cid).status_code == 200


def test_column_unknown_framework_rejected(client):
    r = client.post('/api/board/columns', json={'framework_id': 'nope', 'name': 'x'})
    assert r.status_code == 400


def test_type_crud(client, scrum):
    r = client.post('/api/board/types', json={'framework_id': scrum['id'], 'name': 'UT Type'})
    assert r.status_code == 200
    tid = r.json()['id']
    r = client.put('/api/board/types/' + tid, json={'name': 'UT Type 2'})
    assert r.status_code == 200
    assert client.delete('/api/board/types/' + tid).status_code == 200


def test_iterations_crud(client):
    r = client.post('/api/board/iterations', json={'pod': 'FE', 'name': "UT-Iter'01"})
    assert r.status_code == 200
    iid = r.json()['id']

    rows = client.get('/api/board/iterations', params={'pod': 'FE'}).json()
    assert any(x['id'] == iid for x in rows)

    assert client.delete('/api/board/iterations/' + str(iid)).status_code == 200
    assert client.delete('/api/board/iterations/' + str(iid)).status_code == 404


def test_iteration_requires_pod_and_name(client):
    assert client.post('/api/board/iterations', json={'pod': '', 'name': 'x'}).status_code == 400


def test_workitem_lifecycle_with_updates(client, scrum):
    cols = sorted(scrum['columns'], key=lambda c: c['sort'])
    type_id = scrum['types'][0]['id']

    # create
    r = client.post('/api/board/items', json={
        'title': 'UT Work Item', 'type_id': type_id, 'column_id': cols[0]['id'],
        'sprint': "UT'01", 'pod': 'BE', 'priority': 'High', 'story_points': 3,
    })
    assert r.status_code == 200, r.text
    item = r.json()
    wid = item['id']
    assert item['title'] == 'UT Work Item'

    # update
    r = client.put('/api/board/items/' + str(wid), json={'priority': 'Critical'})
    assert r.status_code == 200
    assert r.json()['priority'] == 'Critical'

    # move to another column
    r = client.put('/api/board/items/' + str(wid) + '/move',
                   json={'column_id': cols[-1]['id'], 'rank': 1.0})
    assert r.status_code == 200
    assert r.json()['column_id'] == cols[-1]['id']

    # daily update
    r = client.post('/api/board/items/' + str(wid) + '/updates',
                    json={'date': '2026-06-30', 'note': 'progress', 'remaining': 2})
    assert r.status_code == 200
    uid = r.json()['id']

    ups = client.get('/api/board/items/' + str(wid) + '/updates').json()
    assert len(ups) == 1

    # an update note is required
    assert client.post('/api/board/items/' + str(wid) + '/updates',
                       json={'note': '   '}).status_code == 400

    # cleanup
    assert client.delete('/api/board/updates/' + str(uid)).status_code == 200
    assert client.delete('/api/board/items/' + str(wid)).status_code == 200
    assert client.delete('/api/board/items/' + str(wid)).status_code == 404


def test_create_workitem_requires_title(client, scrum):
    r = client.post('/api/board/items', json={'title': '  ', 'type_id': scrum['types'][0]['id']})
    assert r.status_code == 400
