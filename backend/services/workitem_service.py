import json
from datetime import datetime, timezone
from sqlmodel import Session, select
from models import WorkItem, BoardColumn, WorkItemType, WorkItemUpdate
from services.audit_service import AuditService

PRIORITIES = ('Critical', 'High', 'Medium', 'Low')


def _now():
    return datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M')


def _to_dict(w: WorkItem):
    return {
        'id': w.id, 'title': w.title, 'type_id': w.type_id, 'column_id': w.column_id,
        'rank': w.rank, 'assignee': w.assignee, 'sprint': w.sprint, 'pod': w.pod,
        'priority': w.priority, 'story_points': w.story_points, 'tags': w.tags,
        'description': w.description, 'acceptance': w.acceptance,
        'custom': json.loads(w.custom_json or '{}'),
        'created_on': w.created_on, 'updated_on': w.updated_on,
    }


def _update_dict(u: WorkItemUpdate):
    return {'id': u.id, 'item_id': u.item_id, 'date': u.date, 'note': u.note,
            'author': u.author, 'remaining': u.remaining, 'created_on': u.created_on}


class WorkItemService:
    @staticmethod
    def list(session: Session, sprint=None, pod=None):
        q = select(WorkItem)
        if sprint:
            q = q.where(WorkItem.sprint == sprint)
        if pod:
            q = q.where(WorkItem.pod == pod)
        rows = sorted(session.exec(q).all(), key=lambda x: (x.column_id, x.rank))
        # Attach update counts + latest date in one pass.
        counts, last = {}, {}
        for u in session.exec(select(WorkItemUpdate)).all():
            counts[u.item_id] = counts.get(u.item_id, 0) + 1
            if u.date > last.get(u.item_id, ''):
                last[u.item_id] = u.date
        out = []
        for w in rows:
            d = _to_dict(w)
            d['updates_count'] = counts.get(w.id, 0)
            d['last_update'] = last.get(w.id, '')
            out.append(d)
        return out

    @staticmethod
    def _validate(session, type_id, column_id):
        if type_id and not session.get(WorkItemType, type_id):
            raise ValueError('Unknown work item type')
        if column_id and not session.get(BoardColumn, column_id):
            raise ValueError('Unknown column')

    @staticmethod
    def create(session: Session, payload: dict):
        title = (payload.get('title') or '').strip()
        if not title:
            raise ValueError('Title is required')
        type_id = payload.get('type_id') or ''
        column_id = payload.get('column_id') or ''
        if not column_id:
            first = sorted(session.exec(select(BoardColumn)).all(), key=lambda c: c.sort)
            column_id = first[0].id if first else ''
        if not type_id:
            t = sorted(session.exec(select(WorkItemType)).all(), key=lambda x: x.sort)
            type_id = t[0].id if t else ''
        WorkItemService._validate(session, type_id, column_id)
        # New items go to the top of their column.
        top = min([w.rank for w in session.exec(select(WorkItem).where(WorkItem.column_id == column_id)).all()], default=0)
        w = WorkItem(
            title=title, type_id=type_id, column_id=column_id, rank=top - 1,
            assignee=payload.get('assignee') or '', sprint=(payload.get('sprint') or '').strip(),
            pod=payload.get('pod') or '', priority=payload.get('priority') or 'Medium',
            story_points=float(payload.get('story_points') or 0), tags=(payload.get('tags') or '').strip(),
            description=payload.get('description') or '', acceptance=payload.get('acceptance') or '',
            custom_json=json.dumps(payload.get('custom') or {}), created_on=_now(), updated_on=_now(),
        )
        session.add(w); session.commit(); session.refresh(w)
        AuditService.log(session, 'CREATE', 'WorkItem', str(w.id))
        return _to_dict(w)

    @staticmethod
    def update(session: Session, item_id, payload: dict):
        w = session.get(WorkItem, item_id)
        if not w:
            return None
        WorkItemService._validate(session, payload.get('type_id'), payload.get('column_id'))
        fields = ('title', 'type_id', 'column_id', 'assignee', 'sprint', 'pod', 'priority', 'tags', 'description', 'acceptance')
        for f in fields:
            if f in payload and payload[f] is not None:
                setattr(w, f, payload[f])
        if 'story_points' in payload and payload['story_points'] is not None:
            w.story_points = float(payload['story_points'] or 0)
        if 'custom' in payload and payload['custom'] is not None:
            w.custom_json = json.dumps(payload['custom'])
        w.updated_on = _now()
        session.add(w); session.commit(); session.refresh(w)
        AuditService.log(session, 'UPDATE', 'WorkItem', str(item_id))
        return _to_dict(w)

    @staticmethod
    def move(session: Session, item_id, column_id, rank):
        """Move a card to a column at a given rank (drag-and-drop persist)."""
        w = session.get(WorkItem, item_id)
        if not w:
            return None
        if column_id:
            if not session.get(BoardColumn, column_id):
                raise ValueError('Unknown column')
            w.column_id = column_id
        if rank is not None:
            w.rank = float(rank)
        w.updated_on = _now()
        session.add(w); session.commit(); session.refresh(w)
        AuditService.log(session, 'UPDATE', 'WorkItem', f'{item_id} -> {w.column_id}')
        return _to_dict(w)

    @staticmethod
    def delete(session: Session, item_id):
        w = session.get(WorkItem, item_id)
        if not w:
            return None
        for u in session.exec(select(WorkItemUpdate).where(WorkItemUpdate.item_id == item_id)).all():
            session.delete(u)
        session.delete(w); session.commit()
        AuditService.log(session, 'DELETE', 'WorkItem', str(item_id))
        return {'ok': True}

    # ---- daily updates -----------------------------------------------------
    @staticmethod
    def list_updates(session: Session, item_id):
        rows = session.exec(select(WorkItemUpdate).where(WorkItemUpdate.item_id == item_id)).all()
        rows = sorted(rows, key=lambda u: (u.date, u.id or 0), reverse=True)
        return [_update_dict(u) for u in rows]

    @staticmethod
    def add_update(session: Session, item_id, date, note, author, remaining):
        if not session.get(WorkItem, item_id):
            raise ValueError('Work item not found')
        note = (note or '').strip()
        if not note:
            raise ValueError('Update note is required')
        u = WorkItemUpdate(
            item_id=item_id,
            date=(date or '').strip() or _now()[:10],
            note=note, author=author or '',
            remaining=float(remaining or 0), created_on=_now(),
        )
        session.add(u); session.commit(); session.refresh(u)
        AuditService.log(session, 'CREATE', 'WorkItemUpdate', f'{item_id}/{u.id}')
        return _update_dict(u)

    @staticmethod
    def delete_update(session: Session, update_id):
        u = session.get(WorkItemUpdate, update_id)
        if not u:
            return None
        session.delete(u); session.commit()
        AuditService.log(session, 'DELETE', 'WorkItemUpdate', str(update_id))
        return {'ok': True}
