"""Tests for the training module: courses, status options, and the status matrix."""

MEMBER = '2012144'


def test_courses_crud(client):
    # seeded courses present
    assert client.get('/api/training/courses').status_code == 200

    r = client.post('/api/training/courses', json={'id': 'UTC01', 'name': 'Unit Test Course'})
    assert r.status_code == 200
    assert r.json() == {'id': 'UTC01', 'name': 'Unit Test Course'}

    # duplicate id rejected
    assert client.post('/api/training/courses', json={'id': 'UTC01', 'name': 'x'}).status_code == 400

    r = client.put('/api/training/courses/UTC01', json={'name': 'Renamed Course'})
    assert r.status_code == 200
    assert r.json()['name'] == 'Renamed Course'

    assert client.delete('/api/training/courses/UTC01').status_code == 200
    assert client.delete('/api/training/courses/UTC01').status_code == 404


def test_course_requires_id(client):
    assert client.post('/api/training/courses', json={'id': '', 'name': 'x'}).status_code == 400


def test_status_options_crud(client):
    r = client.get('/api/training/statuses')
    assert r.status_code == 200
    assert len(r.json()) >= 5  # seeded defaults

    r = client.post('/api/training/statuses', json={'label': 'UT-Status', 'color': '#abcdef'})
    assert r.status_code == 200
    opt_id = r.json()['id']
    assert r.json()['label'] == 'UT-Status'

    # duplicate label rejected (case-insensitive)
    assert client.post('/api/training/statuses', json={'label': 'ut-status'}).status_code == 400

    r = client.put('/api/training/statuses/' + opt_id, json={'label': 'UT-Renamed'})
    assert r.status_code == 200
    assert r.json()['label'] == 'UT-Renamed'

    assert client.delete('/api/training/statuses/' + opt_id).status_code == 200


def test_status_option_requires_label(client):
    assert client.post('/api/training/statuses', json={'label': '  '}).status_code == 400


def test_status_matrix_set_and_read(client):
    course = client.post('/api/training/courses', json={'id': 'UTC02', 'name': 'Matrix Course'}).json()
    r = client.post('/api/training/status', json={
        'memberId': MEMBER, 'courseId': course['id'], 'status': 'Completed',
    })
    assert r.status_code == 200
    assert r.json() == {'ok': True}

    matrix = client.get('/api/training/status').json()
    assert matrix.get(MEMBER, {}).get('UTC02') == 'Completed'

    client.delete('/api/training/courses/UTC02')


def test_set_status_requires_ids(client):
    assert client.post('/api/training/status', json={'memberId': '', 'courseId': 'x'}).status_code == 400
