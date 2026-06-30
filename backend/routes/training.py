from typing import Optional
from fastapi import APIRouter, HTTPException
from sqlmodel import Session
from pydantic import BaseModel

from database import engine
from services.training_service import TrainingService

router = APIRouter(prefix='/api/training', tags=['training'])


class CourseIn(BaseModel):
    id: Optional[str] = None
    name: Optional[str] = None


class StatusIn(BaseModel):
    memberId: Optional[str] = None
    courseId: Optional[str] = None
    status: Optional[str] = ''


class StatusOptionIn(BaseModel):
    label: Optional[str] = None
    color: Optional[str] = None


@router.get('/courses')
def list_courses():
    with Session(engine) as sess:
        return TrainingService.list_courses(sess)


@router.post('/courses')
def add_course(payload: CourseIn):
    with Session(engine) as sess:
        try:
            return TrainingService.add_course(sess, payload.id, payload.name)
        except ValueError as ex:
            raise HTTPException(status_code=400, detail=str(ex))


@router.put('/courses/{course_id}')
def update_course(course_id: str, payload: CourseIn):
    with Session(engine) as sess:
        result = TrainingService.update_course(sess, course_id, payload.name)
        if not result:
            raise HTTPException(status_code=404, detail='Course not found')
        return result


@router.delete('/courses/{course_id}')
def delete_course(course_id: str):
    with Session(engine) as sess:
        result = TrainingService.delete_course(sess, course_id)
        if not result:
            raise HTTPException(status_code=404, detail='Course not found')
        return result


@router.get('/statuses')
def list_status_options():
    with Session(engine) as sess:
        return TrainingService.list_status_options(sess)


@router.post('/statuses')
def add_status_option(payload: StatusOptionIn):
    with Session(engine) as sess:
        try:
            return TrainingService.add_status_option(sess, payload.label, payload.color)
        except ValueError as ex:
            raise HTTPException(status_code=400, detail=str(ex))


@router.put('/statuses/{opt_id}')
def update_status_option(opt_id: str, payload: StatusOptionIn):
    with Session(engine) as sess:
        result = TrainingService.update_status_option(sess, opt_id, payload.label, payload.color)
        if not result:
            raise HTTPException(status_code=404, detail='Status option not found')
        return result


@router.delete('/statuses/{opt_id}')
def delete_status_option(opt_id: str):
    with Session(engine) as sess:
        result = TrainingService.delete_status_option(sess, opt_id)
        if not result:
            raise HTTPException(status_code=404, detail='Status option not found')
        return result


@router.get('/status')
def status_map():
    with Session(engine) as sess:
        return TrainingService.status_map(sess)


@router.post('/status')
def set_status(payload: StatusIn):
    with Session(engine) as sess:
        try:
            return TrainingService.set_status(
                sess, payload.memberId, payload.courseId, payload.status
            )
        except ValueError as ex:
            raise HTTPException(status_code=400, detail=str(ex))
