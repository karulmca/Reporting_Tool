from typing import Optional, List
from fastapi import APIRouter, HTTPException
from sqlmodel import Session
from pydantic import BaseModel

from database import engine
from services.defect_service import DefectService

router = APIRouter(prefix='/api/defects', tags=['defects'])


class DefectIn(BaseModel):
    release: Optional[str] = None
    sprint: Optional[str] = None
    pod: Optional[str] = None
    critical: Optional[int] = 0
    high: Optional[int] = 0
    medium: Optional[int] = 0
    low: Optional[int] = 0
    status: Optional[str] = None
    rca_category: Optional[str] = None
    rca_status: Optional[str] = None
    rca: Optional[str] = None
    comments: Optional[str] = ''


class BulkDefectsIn(BaseModel):
    rows: List[DefectIn] = []


@router.get('')
def list_defects():
    with Session(engine) as sess:
        return DefectService.list(sess)


@router.get('/report')
def defect_report():
    with Session(engine) as sess:
        return DefectService.report(sess)


@router.post('')
def create_defect(payload: DefectIn):
    with Session(engine) as sess:
        try:
            return DefectService.create(
                sess, payload.release, payload.sprint, payload.pod,
                payload.critical, payload.high, payload.medium, payload.low,
                payload.comments, payload.status, payload.rca_category, payload.rca,
                payload.rca_status,
            )
        except ValueError as ex:
            raise HTTPException(status_code=400, detail=str(ex))


@router.post('/bulk')
def bulk_defects(payload: BulkDefectsIn):
    with Session(engine) as sess:
        return DefectService.bulk_upsert(sess, payload.rows)


@router.put('/{defect_id}')
def update_defect(defect_id: int, payload: DefectIn):
    with Session(engine) as sess:
        try:
            result = DefectService.update(
                sess, defect_id, payload.release, payload.sprint, payload.pod,
                payload.critical, payload.high, payload.medium, payload.low,
                payload.comments, payload.status, payload.rca_category, payload.rca,
                payload.rca_status,
            )
        except ValueError as ex:
            raise HTTPException(status_code=400, detail=str(ex))
        if not result:
            raise HTTPException(status_code=404, detail='Defect record not found')
        return result


@router.delete('/{defect_id}')
def delete_defect(defect_id: int):
    with Session(engine) as sess:
        result = DefectService.delete(sess, defect_id)
        if not result:
            raise HTTPException(status_code=404, detail='Defect record not found')
        return result
