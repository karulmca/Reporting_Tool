from typing import Optional, List
from fastapi import APIRouter, HTTPException
from sqlmodel import Session
from pydantic import BaseModel

from database import engine
from services.field_service import FieldService

router = APIRouter(prefix='/api/fields', tags=['fields'])


class FieldIn(BaseModel):
    entity: Optional[str] = None
    label: Optional[str] = None
    type: Optional[str] = 'text'
    options: Optional[List[str]] = None
    on_card: Optional[bool] = False


class FieldUpdate(BaseModel):
    label: Optional[str] = None
    options: Optional[List[str]] = None
    on_card: Optional[bool] = None


class FieldReorder(BaseModel):
    ids: List[str] = []


@router.get('')
def list_fields():
    with Session(engine) as sess:
        return FieldService.grouped(sess)


@router.post('')
def create_field(payload: FieldIn):
    with Session(engine) as sess:
        try:
            return FieldService.create(
                sess, payload.entity, payload.label, payload.type, payload.options, payload.on_card,
            )
        except ValueError as ex:
            raise HTTPException(status_code=400, detail=str(ex))


@router.put('/reorder')
def reorder_fields(payload: FieldReorder):
    with Session(engine) as sess:
        return FieldService.reorder(sess, payload.ids)


@router.put('/{field_id}')
def update_field(field_id: str, payload: FieldUpdate):
    with Session(engine) as sess:
        result = FieldService.update(sess, field_id, payload.label, payload.options, payload.on_card)
        if not result:
            raise HTTPException(status_code=404, detail='Field not found')
        return result


@router.delete('/{field_id}')
def delete_field(field_id: str):
    with Session(engine) as sess:
        result = FieldService.delete(sess, field_id)
        if not result:
            raise HTTPException(status_code=404, detail='Field not found')
        return result
