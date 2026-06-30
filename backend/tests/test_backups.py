"""Tests for the database backup/restore module.

The backup directory is redirected to a temp folder so tests never write real
snapshots into backend/backups/.
"""
import os

import pytest

import services.backup_service as backup_service


@pytest.fixture(autouse=True)
def temp_backup_dir(tmp_path, monkeypatch):
    d = tmp_path / 'backups'
    monkeypatch.setattr(backup_service, 'BACKUP_DIR', str(d))
    yield str(d)


def test_create_and_list_backup(client):
    r = client.post('/api/backups', json={'label': 'smoke'})
    assert r.status_code == 200, r.text
    info = r.json()
    assert info['name'].startswith('bluebolt_')
    assert info['name'].endswith('_smoke.db')
    assert info['size'] > 0

    rows = client.get('/api/backups').json()
    assert any(b['name'] == info['name'] for b in rows)


def test_download_backup(client):
    name = client.post('/api/backups', json={'label': 'dl'}).json()['name']
    r = client.get('/api/backups/' + name + '/download')
    assert r.status_code == 200
    assert r.content[:16] == b'SQLite format 3\x00'


def test_restore_backup_keeps_data(client):
    # Snapshot current state, then restore it; health should still report data.
    name = client.post('/api/backups', json={'label': 'rst'}).json()['name']
    before = client.get('/api/health').json()['members']

    r = client.post('/api/backups/' + name + '/restore')
    assert r.status_code == 200
    assert r.json() == {'restored': name}

    after = client.get('/api/health').json()['members']
    assert after == before

    # Restore also writes a safety 'pre-restore' snapshot.
    rows = client.get('/api/backups').json()
    assert any('pre-restore' in b['name'] for b in rows)


def test_delete_backup(client):
    name = client.post('/api/backups', json={'label': 'del'}).json()['name']
    assert client.delete('/api/backups/' + name).status_code == 200
    # second delete -> not found
    assert client.delete('/api/backups/' + name).status_code == 404


def test_download_missing_backup_404(client):
    assert client.get('/api/backups/nope.db/download').status_code == 404


def test_path_traversal_rejected(client):
    # Encoded traversal must not escape the backup directory.
    r = client.get('/api/backups/..%2F..%2Fmain.py/download')
    assert r.status_code == 404
