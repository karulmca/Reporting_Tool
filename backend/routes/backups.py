from typing import Optional
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

from services.backup_service import BackupService

router = APIRouter(prefix='/api/backups', tags=['backups'])


class BackupIn(BaseModel):
    label: Optional[str] = ''


@router.get('')
def list_backups():
    return BackupService.list()


@router.post('')
def create_backup(payload: BackupIn = BackupIn()):
    try:
        return BackupService.create(payload.label or '')
    except ValueError as ex:
        raise HTTPException(status_code=400, detail=str(ex))


@router.get('/{name}/download')
def download_backup(name: str):
    try:
        path = BackupService.path(name)
    except ValueError as ex:
        raise HTTPException(status_code=404, detail=str(ex))
    return FileResponse(path, filename=name, media_type='application/octet-stream')


@router.post('/{name}/restore')
def restore_backup(name: str):
    try:
        return BackupService.restore(name)
    except ValueError as ex:
        raise HTTPException(status_code=404, detail=str(ex))


@router.delete('/{name}')
def delete_backup(name: str):
    try:
        return BackupService.delete(name)
    except ValueError as ex:
        raise HTTPException(status_code=404, detail=str(ex))
