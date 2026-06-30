from typing import Optional, List
from fastapi import APIRouter, HTTPException
from sqlmodel import Session
from pydantic import BaseModel

from database import engine
from services.member_service import MemberService

router = APIRouter(prefix='/api/members', tags=['members'])


class MemberIn(BaseModel):
    id: Optional[str] = None
    name: Optional[str] = None
    pod: Optional[str] = None
    sl: Optional[str] = 'M&E'
    target: Optional[int] = 12
    custom: Optional[dict] = None


class BulkMembersIn(BaseModel):
    rows: List[MemberIn] = []


@router.get('')
def list_members():
    with Session(engine) as sess:
        return MemberService.list(sess)


@router.post('')
def create_member(payload: MemberIn):
    with Session(engine) as sess:
        try:
            return MemberService.create(
                sess, payload.id, payload.name, payload.pod,
                payload.sl, payload.target, payload.custom,
            )
        except ValueError as ex:
            raise HTTPException(status_code=400, detail=str(ex))


@router.post('/bulk')
def bulk_members(payload: BulkMembersIn):
    with Session(engine) as sess:
        return MemberService.bulk_upsert(sess, payload.rows)


@router.put('/{member_id}')
def update_member(member_id: str, payload: MemberIn):
    with Session(engine) as sess:
        result = MemberService.update(
            sess, member_id, payload.name, payload.pod,
            payload.sl, payload.target, payload.custom,
        )
        if not result:
            raise HTTPException(status_code=404, detail='Member not found')
        return result


@router.delete('/{member_id}')
def delete_member(member_id: str):
    with Session(engine) as sess:
        result = MemberService.delete(sess, member_id)
        if not result:
            raise HTTPException(status_code=404, detail='Member not found')
        return result
