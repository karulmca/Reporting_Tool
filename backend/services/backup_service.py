import os
import re
import shutil
from datetime import datetime

from sqlalchemy import text

import database

# Backups live next to the DB in a dedicated folder so they are easy to find
# and never clash with the live file.
BACKUP_DIR = os.path.join(database.BASE_DIR, 'backups')
_SAFE = re.compile(r'[^A-Za-z0-9._-]+')


def _ensure_dir():
    os.makedirs(BACKUP_DIR, exist_ok=True)


def _safe_label(label: str) -> str:
    """Reduce a user-supplied label to filename-safe characters."""
    cleaned = _SAFE.sub('-', (label or '').strip()).strip('-')
    return cleaned[:40]


def _resolve(name: str) -> str:
    """Map a backup name to its absolute path, rejecting any path traversal."""
    if not name or '/' in name or '\\' in name or os.path.basename(name) != name:
        raise ValueError('Invalid backup name')
    path = os.path.join(BACKUP_DIR, name)
    if not os.path.exists(path):
        raise ValueError('Backup not found')
    return path


class BackupService:
    DIR = BACKUP_DIR

    @staticmethod
    def create(label: str = '') -> dict:
        """Take a consistent snapshot of the live DB into the backups folder.

        Uses SQLite's `VACUUM INTO`, which produces a clean, compact copy that is
        safe to run while the app is serving requests (no need to stop the server).
        """
        _ensure_dir()
        if not os.path.exists(database.DB_FILE):
            raise ValueError('Database file not found')

        stamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        suffix = _safe_label(label)
        name = f'bluebolt_{stamp}{("_" + suffix) if suffix else ""}.db'
        dest = os.path.join(BACKUP_DIR, name)

        with database.engine.connect() as conn:
            # VACUUM INTO needs a path with forward slashes / escaped quotes; bind
            # it safely as a literal by escaping single quotes.
            safe_path = dest.replace('\\', '/').replace("'", "''")
            conn.execute(text(f"VACUUM INTO '{safe_path}'"))

        return BackupService._info(name)

    @staticmethod
    def list() -> list:
        """Return all backups, newest first."""
        _ensure_dir()
        items = [
            BackupService._info(f)
            for f in os.listdir(BACKUP_DIR)
            if f.endswith('.db') and os.path.isfile(os.path.join(BACKUP_DIR, f))
        ]
        items.sort(key=lambda x: x['created_ts'], reverse=True)
        return items

    @staticmethod
    def path(name: str) -> str:
        return _resolve(name)

    @staticmethod
    def restore(name: str) -> dict:
        """Replace the live DB with the chosen backup.

        A safety snapshot of the current data is taken first (label
        'pre-restore') so an accidental restore is always reversible. The engine
        connection pool is disposed so the file handle is released before the
        file is overwritten (required on Windows).
        """
        src = _resolve(name)
        # Snapshot current state before we overwrite it.
        BackupService.create('pre-restore')
        database.engine.dispose()
        shutil.copy2(src, database.DB_FILE)
        # Re-run startup migrations/seed against the restored file.
        database.init_db()
        return {'restored': name}

    @staticmethod
    def delete(name: str) -> dict:
        path = _resolve(name)
        os.remove(path)
        return {'deleted': name}

    @staticmethod
    def _info(name: str) -> dict:
        path = os.path.join(BACKUP_DIR, name)
        st = os.stat(path)
        return {
            'name': name,
            'size': st.st_size,
            'created_ts': st.st_mtime,
            'created': datetime.fromtimestamp(st.st_mtime).strftime('%Y-%m-%d %H:%M:%S'),
        }
