from typing import Optional, List
from fastapi import APIRouter, HTTPException
from sqlmodel import Session
from pydantic import BaseModel

from database import engine
from services.board_service import BoardService
from services.workitem_service import WorkItemService

router = APIRouter(prefix='/api/board', tags=['board'])


# ---- board configuration (frameworks own columns + types) ------------------
class FrameworkIn(BaseModel):
    name: Optional[str] = None
    iteration_label: Optional[str] = None
    uses_sprints: Optional[bool] = None
    sprint_length_weeks: Optional[int] = None
    swimlane: Optional[str] = None


class ColumnIn(BaseModel):
    framework_id: Optional[str] = None
    name: Optional[str] = None
    wip_limit: Optional[int] = None
    is_done: Optional[bool] = None
    color: Optional[str] = None


class TypeIn(BaseModel):
    framework_id: Optional[str] = None
    name: Optional[str] = None
    color: Optional[str] = None


class ReorderIn(BaseModel):
    ids: List[str] = []


class IterationIn(BaseModel):
    pod: Optional[str] = None
    name: Optional[str] = None


@router.get('/config')
def board_config():
    with Session(engine) as s:
        return {
            'frameworks': BoardService.list_frameworks(s),
            'iterations': BoardService.iterations_map(s),
        }


# frameworks
@router.post('/frameworks')
def create_framework(p: FrameworkIn):
    with Session(engine) as s:
        try:
            return BoardService.create_framework(s, p.name, p.iteration_label or 'Sprint',
                                                  p.uses_sprints if p.uses_sprints is not None else True,
                                                  p.sprint_length_weeks or 2, p.swimlane or '')
        except ValueError as ex:
            raise HTTPException(status_code=400, detail=str(ex))


@router.put('/frameworks/{fid}')
def update_framework(fid: str, p: FrameworkIn):
    with Session(engine) as s:
        r = BoardService.update_framework(s, fid, name=p.name, iteration_label=p.iteration_label,
                                          uses_sprints=p.uses_sprints, sprint_length_weeks=p.sprint_length_weeks, swimlane=p.swimlane)
        if not r:
            raise HTTPException(status_code=404, detail='Framework not found')
        return r


@router.delete('/frameworks/{fid}')
def delete_framework(fid: str):
    with Session(engine) as s:
        try:
            r = BoardService.delete_framework(s, fid)
        except ValueError as ex:
            raise HTTPException(status_code=400, detail=str(ex))
        if not r:
            raise HTTPException(status_code=404, detail='Framework not found')
        return r


# columns
@router.post('/columns')
def create_column(p: ColumnIn):
    with Session(engine) as s:
        try:
            return BoardService.create_column(s, p.framework_id, p.name, p.wip_limit or 0, bool(p.is_done), p.color or '#3b82f6')
        except ValueError as ex:
            raise HTTPException(status_code=400, detail=str(ex))


@router.put('/columns/reorder')
def reorder_columns(p: ReorderIn):
    with Session(engine) as s:
        return BoardService.reorder_columns(s, p.ids)


@router.put('/columns/{col_id}')
def update_column(col_id: str, p: ColumnIn):
    with Session(engine) as s:
        r = BoardService.update_column(s, col_id, p.name, p.wip_limit, p.is_done, p.color)
        if not r:
            raise HTTPException(status_code=404, detail='Column not found')
        return r


@router.delete('/columns/{col_id}')
def delete_column(col_id: str):
    with Session(engine) as s:
        try:
            r = BoardService.delete_column(s, col_id)
        except ValueError as ex:
            raise HTTPException(status_code=400, detail=str(ex))
        if not r:
            raise HTTPException(status_code=404, detail='Column not found')
        return r


# types
@router.post('/types')
def create_type(p: TypeIn):
    with Session(engine) as s:
        try:
            return BoardService.create_type(s, p.framework_id, p.name, p.color or '#3b82f6')
        except ValueError as ex:
            raise HTTPException(status_code=400, detail=str(ex))


@router.put('/types/{type_id}')
def update_type(type_id: str, p: TypeIn):
    with Session(engine) as s:
        r = BoardService.update_type(s, type_id, p.name, p.color)
        if not r:
            raise HTTPException(status_code=404, detail='Type not found')
        return r


@router.delete('/types/{type_id}')
def delete_type(type_id: str):
    with Session(engine) as s:
        try:
            r = BoardService.delete_type(s, type_id)
        except ValueError as ex:
            raise HTTPException(status_code=400, detail=str(ex))
        if not r:
            raise HTTPException(status_code=404, detail='Type not found')
        return r


# per-POD iterations
@router.get('/iterations')
def list_iterations(pod: Optional[str] = None):
    with Session(engine) as s:
        return BoardService.list_iterations(s, pod)


@router.post('/iterations')
def add_iteration(p: IterationIn):
    with Session(engine) as s:
        try:
            return BoardService.add_iteration(s, p.pod, p.name)
        except ValueError as ex:
            raise HTTPException(status_code=400, detail=str(ex))


@router.delete('/iterations/{iter_id}')
def delete_iteration(iter_id: int):
    with Session(engine) as s:
        r = BoardService.delete_iteration(s, iter_id)
        if not r:
            raise HTTPException(status_code=404, detail='Iteration not found')
        return r


# ---- work items ------------------------------------------------------------
class WorkItemIn(BaseModel):
    title: Optional[str] = None
    type_id: Optional[str] = None
    column_id: Optional[str] = None
    assignee: Optional[str] = None
    sprint: Optional[str] = None
    pod: Optional[str] = None
    priority: Optional[str] = None
    story_points: Optional[float] = None
    tags: Optional[str] = None
    description: Optional[str] = None
    acceptance: Optional[str] = None
    custom: Optional[dict] = None


class MoveIn(BaseModel):
    column_id: Optional[str] = None
    rank: Optional[float] = None


class UpdateIn(BaseModel):
    date: Optional[str] = None
    note: Optional[str] = None
    author: Optional[str] = None
    remaining: Optional[float] = None


@router.get('/items')
def list_items(sprint: Optional[str] = None, pod: Optional[str] = None):
    with Session(engine) as s:
        return WorkItemService.list(s, sprint, pod)


@router.post('/items')
def create_item(p: WorkItemIn):
    with Session(engine) as s:
        try:
            return WorkItemService.create(s, p.dict())
        except ValueError as ex:
            raise HTTPException(status_code=400, detail=str(ex))


@router.put('/items/{item_id}')
def update_item(item_id: int, p: WorkItemIn):
    with Session(engine) as s:
        try:
            r = WorkItemService.update(s, item_id, p.dict(exclude_unset=True))
        except ValueError as ex:
            raise HTTPException(status_code=400, detail=str(ex))
        if not r:
            raise HTTPException(status_code=404, detail='Work item not found')
        return r


@router.put('/items/{item_id}/move')
def move_item(item_id: int, p: MoveIn):
    with Session(engine) as s:
        try:
            r = WorkItemService.move(s, item_id, p.column_id, p.rank)
        except ValueError as ex:
            raise HTTPException(status_code=400, detail=str(ex))
        if not r:
            raise HTTPException(status_code=404, detail='Work item not found')
        return r


@router.delete('/items/{item_id}')
def delete_item(item_id: int):
    with Session(engine) as s:
        r = WorkItemService.delete(s, item_id)
        if not r:
            raise HTTPException(status_code=404, detail='Work item not found')
        return r


# ---- daily updates ---------------------------------------------------------
@router.get('/items/{item_id}/updates')
def list_updates(item_id: int):
    with Session(engine) as s:
        return WorkItemService.list_updates(s, item_id)


@router.post('/items/{item_id}/updates')
def add_update(item_id: int, p: UpdateIn):
    with Session(engine) as s:
        try:
            return WorkItemService.add_update(s, item_id, p.date, p.note, p.author, p.remaining)
        except ValueError as ex:
            raise HTTPException(status_code=400, detail=str(ex))


@router.delete('/updates/{update_id}')
def delete_update(update_id: int):
    with Session(engine) as s:
        r = WorkItemService.delete_update(s, update_id)
        if not r:
            raise HTTPException(status_code=404, detail='Update not found')
        return r
