from typing import Optional, List
from fastapi import APIRouter, HTTPException
from sqlmodel import Session
from pydantic import BaseModel

from database import engine
from services.sprint_service import SprintService

router = APIRouter(prefix='/api/sprints', tags=['sprints'])


class SprintIn(BaseModel):
    member: Optional[str] = None
    sprint: Optional[str] = None
    committed: Optional[float] = 0
    completed: Optional[float] = 0
    targetIdeas: Optional[float] = 0
    comments: Optional[str] = ''


class RenameIn(BaseModel):
    old: Optional[str] = None
    new: Optional[str] = None


class BulkSprintsIn(BaseModel):
    rows: List[SprintIn] = []


@router.get('')
def list_sprints():
    with Session(engine) as sess:
        return SprintService.list(sess)


@router.post('')
def upsert_sprint(payload: SprintIn):
    with Session(engine) as sess:
        try:
            return SprintService.upsert(
                sess, payload.member, payload.sprint, payload.committed,
                payload.completed, payload.targetIdeas, payload.comments,
            )
        except ValueError as ex:
            raise HTTPException(status_code=400, detail=str(ex))


@router.post('/bulk')
def bulk_sprints(payload: BulkSprintsIn):
    with Session(engine) as sess:
        return SprintService.bulk_upsert(sess, payload.rows)


@router.delete('')
def delete_sprint(member: str, sprint: str):
    with Session(engine) as sess:
        result = SprintService.delete(sess, member, sprint)
        if not result:
            raise HTTPException(status_code=404, detail='Sprint entry not found')
        return result


@router.put('/rename')
def rename_sprint(payload: RenameIn):
    with Session(engine) as sess:
        try:
            result = SprintService.rename(sess, payload.old, payload.new)
        except ValueError as ex:
            raise HTTPException(status_code=400, detail=str(ex))
        if not result:
            raise HTTPException(status_code=404, detail='No entries for that sprint')
        return result


@router.delete('/by-name')
def delete_sprint_by_name(sprint: str):
    with Session(engine) as sess:
        result = SprintService.delete_by_sprint(sess, sprint)
        if not result:
            raise HTTPException(status_code=404, detail='No entries for that sprint')
        return result
