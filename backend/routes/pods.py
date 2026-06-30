from typing import Optional
from fastapi import APIRouter, HTTPException
from sqlmodel import Session
from pydantic import BaseModel

from database import engine
from services.pod_service import PODService

router = APIRouter(prefix='/api/pods', tags=['pods'])


class PODIn(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    sl: Optional[str] = 'M&E'
    color: Optional[str] = '#3b82f6'
    framework_id: Optional[str] = None


@router.get('')
def list_pods():
    with Session(engine) as sess:
        return PODService.list(sess)


@router.post('')
def create_pod(payload: PODIn):
    with Session(engine) as sess:
        try:
            return PODService.create(sess, payload.code, payload.name, payload.sl, payload.color)
        except ValueError as ex:
            raise HTTPException(status_code=400, detail=str(ex))


@router.put('/{code}')
def update_pod(code: str, payload: PODIn):
    with Session(engine) as sess:
        result = PODService.update(sess, code, payload.name, payload.sl, payload.color, payload.framework_id)
        if not result:
            raise HTTPException(status_code=404, detail='POD not found')
        return result


@router.delete('/{code}')
def delete_pod(code: str):
    with Session(engine) as sess:
        try:
            result = PODService.delete(sess, code)
        except ValueError as ex:
            raise HTTPException(status_code=400, detail=str(ex))
        if not result:
            raise HTTPException(status_code=404, detail='POD not found')
        return result
