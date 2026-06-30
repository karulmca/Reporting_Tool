from typing import Optional, List
from fastapi import APIRouter, HTTPException
from sqlmodel import Session
from pydantic import BaseModel

from database import engine
from services.idea_service import IdeaService

router = APIRouter(prefix='/api/ideas', tags=['ideas'])


class IdeaIn(BaseModel):
    idea_id: Optional[str] = None
    title: Optional[str] = None
    problem: Optional[str] = None
    desc: Optional[str] = None
    submitter: Optional[str] = None
    submitter_name: Optional[str] = None
    contributors: Optional[str] = None
    status: Optional[str] = 'Proposed'
    stage: Optional[str] = None
    workflow: Optional[str] = None
    source: Optional[str] = None
    project_name: Optional[str] = None
    solution: Optional[str] = None
    benefit: Optional[str] = None
    competency: Optional[str] = None
    tags: Optional[str] = None
    created_on: Optional[str] = None
    rating: Optional[float] = None
    savings_type: Optional[str] = None
    savings_amount: Optional[float] = None
    sprint: Optional[str] = ''
    comments: Optional[str] = None
    custom: Optional[dict] = None


class BulkIdeasIn(BaseModel):
    rows: List[IdeaIn] = []


# Curated optional fields forwarded to the service as **extra. 'contributors' is
# only added for update() — create() already takes it as a positional argument.
_EXTRA = ('idea_id', 'submitter_name', 'stage', 'workflow', 'source', 'project_name',
          'solution', 'benefit', 'competency', 'tags', 'created_on', 'rating',
          'savings_type', 'savings_amount', 'comments')


def _extra(payload: 'IdeaIn', with_contrib: bool = False):
    keys = _EXTRA + (('contributors',) if with_contrib else ())
    return {k: getattr(payload, k) for k in keys}


@router.get('')
def list_ideas():
    with Session(engine) as sess:
        return IdeaService.list(sess)


@router.post('')
def create_idea(payload: IdeaIn):
    with Session(engine) as sess:
        try:
            return IdeaService.create(
                sess, payload.title, payload.problem, payload.desc,
                payload.submitter, payload.contributors, payload.status, payload.custom,
                payload.sprint, **_extra(payload),
            )
        except ValueError as ex:
            raise HTTPException(status_code=400, detail=str(ex))


@router.post('/bulk')
def bulk_ideas(payload: BulkIdeasIn):
    with Session(engine) as sess:
        return IdeaService.bulk_upsert(sess, payload.rows)


@router.put('/{idea_id}')
def update_idea(idea_id: str, payload: IdeaIn):
    with Session(engine) as sess:
        result = IdeaService.update(
            sess, idea_id, payload.title, payload.status,
            payload.problem, payload.desc, payload.custom, payload.sprint, **_extra(payload, with_contrib=True),
        )
        if not result:
            raise HTTPException(status_code=404, detail='Idea not found')
        return result


@router.delete('/{idea_id}')
def delete_idea(idea_id: str):
    with Session(engine) as sess:
        result = IdeaService.delete(sess, idea_id)
        if not result:
            raise HTTPException(status_code=404, detail='Idea not found')
        return result
