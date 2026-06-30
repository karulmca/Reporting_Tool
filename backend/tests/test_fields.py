"""Tests for the custom fields module."""


def test_list_fields_grouped(client):
    r = client.get('/api/fields')
    assert r.status_code == 200
    body = r.json()
    for entity in ('member', 'idea', 'workitem'):
        assert entity in body
        assert isinstance(body[entity], list)


def test_create_update_reorder_delete_field(client):
    # create two member fields
    a = client.post('/api/fields', json={'entity': 'member', 'label': 'Field A', 'type': 'text'})
    b = client.post('/api/fields', json={'entity': 'member', 'label': 'Field B',
                                         'type': 'select', 'options': ['x', 'y']})
    assert a.status_code == 200 and b.status_code == 200
    aid, bid = a.json()['id'], b.json()['id']
    assert b.json()['options'] == ['x', 'y']

    # update
    r = client.put('/api/fields/' + aid, json={'label': 'Field A2', 'on_card': True})
    assert r.status_code == 200
    assert r.json()['label'] == 'Field A2'
    assert r.json()['on_card'] is True

    # reorder: put B before A
    r = client.put('/api/fields/reorder', json={'ids': [bid, aid]})
    assert r.status_code == 200
    member_fields = r.json()['member']
    order = [f['id'] for f in member_fields if f['id'] in (aid, bid)]
    assert order == [bid, aid]

    # delete both
    assert client.delete('/api/fields/' + aid).status_code == 200
    assert client.delete('/api/fields/' + bid).status_code == 200


def test_create_field_invalid_entity(client):
    r = client.post('/api/fields', json={'entity': 'banana', 'label': 'x'})
    assert r.status_code == 400


def test_create_field_requires_label(client):
    r = client.post('/api/fields', json={'entity': 'idea', 'label': '  '})
    assert r.status_code == 400


def test_update_missing_field_404(client):
    assert client.put('/api/fields/nope', json={'label': 'x'}).status_code == 404


def test_delete_missing_field_404(client):
    assert client.delete('/api/fields/nope').status_code == 404
