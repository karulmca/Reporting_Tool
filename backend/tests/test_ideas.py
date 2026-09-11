"""Tests for the ideas module.

The idea invariant: every idea needs a known submitter (employee id) and an
idea_id. The stored primary key is "{submitter}-{idea_id}".
"""

SUBMITTER = '2012144'  # seeded member


def test_list_ideas_seeded(client):
    r = client.get('/api/ideas')
    assert r.status_code == 200
    assert isinstance(r.json(), list)
    assert len(r.json()) >= 5


def test_create_update_delete_idea(client):
    r = client.post('/api/ideas', json={
        'idea_id': 'UT-001', 'title': 'Unit Test Idea', 'submitter': SUBMITTER,
        'problem': 'p', 'desc': 'd', 'status': 'Proposed',
    })
    assert r.status_code == 200, r.text
    body = r.json()
    iid = body['id']
    assert iid == f'{SUBMITTER}-UT-001'
    assert body['status'] == 'Proposed'

    r = client.put('/api/ideas/' + iid, json={'title': 'Updated Title', 'status': 'In Progress'})
    assert r.status_code == 200
    assert r.json()['title'] == 'Updated Title'
    assert r.json()['status'] == 'In Progress'

    r = client.delete('/api/ideas/' + iid)
    assert r.status_code == 200
    assert r.json() == {'ok': True}


def test_create_idea_requires_title(client):
    r = client.post('/api/ideas', json={'idea_id': 'UT-X', 'submitter': SUBMITTER, 'title': ''})
    assert r.status_code == 400
    assert 'title' in r.json()['error'].lower()


def test_create_idea_requires_known_submitter(client):
    r = client.post('/api/ideas', json={'idea_id': 'UT-Y', 'title': 'x', 'submitter': '999999'})
    assert r.status_code == 400
    assert 'submitter' in r.json()['error'].lower()


def test_create_idea_requires_idea_id(client):
    r = client.post('/api/ideas', json={'title': 'x', 'submitter': SUBMITTER})
    assert r.status_code == 400


def test_create_duplicate_idea_rejected(client):
    payload = {'idea_id': 'UT-DUP', 'title': 'dup', 'submitter': SUBMITTER}
    client.post('/api/ideas', json=payload)
    r = client.post('/api/ideas', json=payload)
    assert r.status_code == 400
    client.delete('/api/ideas/' + f'{SUBMITTER}-UT-DUP')


def test_stage_maps_to_status(client):
    r = client.post('/api/ideas', json={
        'idea_id': 'UT-STG', 'title': 'staged', 'submitter': SUBMITTER,
        'stage': 'Implemented',
    })
    assert r.status_code == 200
    assert r.json()['status'] == 'Implemented'
    client.delete('/api/ideas/' + f'{SUBMITTER}-UT-STG')


def test_update_missing_idea_404(client):
    assert client.put('/api/ideas/nope-1', json={'title': 'x'}).status_code == 404


def test_bulk_ideas(client):
    rows = [
        {'idea_id': 'BLK-1', 'title': 'Bulk Idea 1', 'submitter': SUBMITTER},
        {'idea_id': '', 'title': 'no id', 'submitter': SUBMITTER},  # error row
    ]
    r = client.post('/api/ideas/bulk', json={'rows': rows})
    assert r.status_code == 200
    res = r.json()
    assert res['created'] == 1
    assert len(res['errors']) == 1
    client.delete('/api/ideas/' + f'{SUBMITTER}-BLK-1')


def test_bulk_ideas_maps_benefit_value_and_metric(client):
    """'Benefit Value (In $)' -> savings_amount, 'Bluebolt Metric' -> metric."""
    rows = [{'idea_id': 'BLK-SAV', 'title': 'Savings idea', 'submitter': SUBMITTER,
             'savings_amount': 25000, 'metric': 'Productivity'}]
    r = client.post('/api/ideas/bulk', json={'rows': rows})
    assert r.status_code == 200
    assert r.json()['created'] == 1

    listed = next(i for i in client.get('/api/ideas').json() if i['idea_id'] == 'BLK-SAV')
    assert listed['savings_amount'] == 25000
    assert listed['metric'] == 'Productivity'
    client.delete('/api/ideas/' + f'{SUBMITTER}-BLK-SAV')


def test_bulk_ideas_captures_full_raw_row(client):
    """Every sheet column (even ones with no dedicated field) is kept on the
    record so it's available later without another schema change."""
    rows = [{'idea_id': 'BLK-RAW', 'title': 'Raw row idea', 'submitter': SUBMITTER,
             'raw': {'Idea ID': 'BLK-RAW', 'Some Future Column': 'keep me'}}]
    r = client.post('/api/ideas/bulk', json={'rows': rows})
    assert r.status_code == 200
    assert r.json()['created'] == 1

    listed = next(i for i in client.get('/api/ideas').json() if i['idea_id'] == 'BLK-RAW')
    assert listed['raw']['Some Future Column'] == 'keep me'
    client.delete('/api/ideas/' + f'{SUBMITTER}-BLK-RAW')


def test_bulk_reupload_preserves_manual_savings_type(client):
    """Re-uploading a sheet with no 'Dollar Saving Type' column must not wipe
    out a Hard/Soft Dollar tag that was set manually via the Idea edit form."""
    idea_id = f'{SUBMITTER}-BLK-KEEP'
    r = client.post('/api/ideas', json={'idea_id': 'BLK-KEEP', 'title': 'Keep type', 'submitter': SUBMITTER})
    assert r.status_code == 200
    client.put('/api/ideas/' + idea_id, json={'savings_type': 'Hard Dollar'})

    # Re-upload the same idea via bulk, as the Idea Wall export would (no savings_type).
    rows = [{'idea_id': 'BLK-KEEP', 'title': 'Keep type', 'submitter': SUBMITTER, 'savings_amount': 9000}]
    r = client.post('/api/ideas/bulk', json={'rows': rows})
    assert r.status_code == 200
    assert r.json()['updated'] == 1

    listed = next(i for i in client.get('/api/ideas').json() if i['idea_id'] == 'BLK-KEEP')
    assert listed['savings_type'] == 'Hard Dollar'
    assert listed['savings_amount'] == 9000
    client.delete('/api/ideas/' + idea_id)
