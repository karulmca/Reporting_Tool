"""Tests for the defect density module."""


def test_list_defects_seeded(client):
    r = client.get('/api/defects')
    assert r.status_code == 200
    assert len(r.json()) >= 6
    # derived fields present
    d = r.json()[0]
    assert 'total' in d and 'weighted' in d


def test_report_shape(client):
    r = client.get('/api/defects/report')
    assert r.status_code == 200
    body = r.json()
    for key in ('totals', 'weights', 'by_release', 'by_sprint', 'by_pod',
                'by_status', 'by_category', 'by_rca_status'):
        assert key in body
    assert body['weights'] == {'critical': 10, 'high': 5, 'medium': 2, 'low': 1}


def test_create_update_delete_defect(client):
    r = client.post('/api/defects', json={
        'release': 'RUT.1', 'sprint': "UT'01", 'pod': 'FE',
        'critical': 1, 'high': 2, 'medium': 0, 'low': 4,
    })
    assert r.status_code == 200, r.text
    body = r.json()
    did = body['id']
    assert body['total'] == 7
    assert body['weighted'] == 1 * 10 + 2 * 5 + 4 * 1

    r = client.put('/api/defects/' + str(did), json={'high': 0, 'comments': 'fixed'})
    assert r.status_code == 200
    assert r.json()['high'] == 0
    assert r.json()['comments'] == 'fixed'

    assert client.delete('/api/defects/' + str(did)).status_code == 200
    assert client.delete('/api/defects/' + str(did)).status_code == 404


def test_create_requires_release_and_sprint(client):
    assert client.post('/api/defects', json={'release': '', 'sprint': "UT'02"}).status_code == 400
    assert client.post('/api/defects', json={'release': 'R', 'sprint': ''}).status_code == 400


def test_create_unknown_pod_rejected(client):
    r = client.post('/api/defects', json={'release': 'RUT.9', 'sprint': "UT'09", 'pod': 'ZZ'})
    assert r.status_code == 400
    assert 'Unknown POD' in r.json()['error']


def test_create_duplicate_defect_rejected(client):
    payload = {'release': 'RDUP', 'sprint': "UT'05", 'pod': 'BE', 'low': 1}
    first = client.post('/api/defects', json=payload)
    assert first.status_code == 200
    r = client.post('/api/defects', json=payload)
    assert r.status_code == 400
    client.delete('/api/defects/' + str(first.json()['id']))
