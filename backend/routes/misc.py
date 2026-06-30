import os
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from sqlmodel import Session, select

from database import engine, DB_FILE
from models import Member, Idea, Sprint, DefectRecord
from services.audit_service import AuditService

router = APIRouter(prefix='/api', tags=['misc'])


@router.get('/health')
def health():
    with Session(engine) as sess:
        return {
            'status': 'ok',
            'members': len(sess.exec(select(Member)).all()),
            'ideas': len(sess.exec(select(Idea)).all()),
            'sprints': len(sess.exec(select(Sprint)).all()),
            'defects': len(sess.exec(select(DefectRecord)).all()),
        }


@router.get('/audit')
def audit():
    with Session(engine) as sess:
        return AuditService.list(sess)


@router.get('/backup')
def backup():
    if not os.path.exists(DB_FILE):
        raise HTTPException(status_code=404, detail='Database file not found')
    return FileResponse(
        DB_FILE,
        filename='bluebolt_backup.db',
        media_type='application/octet-stream',
    )
