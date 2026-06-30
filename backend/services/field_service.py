import json
import uuid
from sqlmodel import Session, select
from models import CustomField
from services.audit_service import AuditService

ENTITIES = ('member', 'idea', 'workitem')


def _to_dict(f: CustomField):
    return {
        'id': f.id,
        'label': f.label,
        'type': f.type,
        'options': json.loads(f.options_json or '[]'),
        'on_card': bool(f.on_card),
        'sort': f.sort,
    }


class FieldService:
    @staticmethod
    def grouped(session: Session):
        """Return {'member': [...], 'idea': [...], 'workitem': [...]}."""
        out = {e: [] for e in ENTITIES}
        rows = sorted(session.exec(select(CustomField)).all(), key=lambda x: (x.sort or 0))
        for f in rows:
            out.setdefault(f.entity, []).append(_to_dict(f))
        return out

    @staticmethod
    def create(session: Session, entity: str, label: str, type: str, options: list, on_card=False):
        if entity not in ENTITIES:
            raise ValueError('entity must be member, idea or workitem')
        if not (label or '').strip():
            raise ValueError('Label required')
        nxt = len([f for f in session.exec(select(CustomField)).all() if f.entity == entity])
        f = CustomField(
            id=uuid.uuid4().hex[:8],
            entity=entity,
            label=label.strip(),
            type=type or 'text',
            options_json=json.dumps(options or []),
            on_card=bool(on_card),
            sort=nxt,
        )
        session.add(f)
        session.commit()
        AuditService.log(session, 'CREATE', 'Field', f.id)
        return _to_dict(f)

    @staticmethod
    def update(session: Session, id: str, label=None, options=None, on_card=None):
        f = session.get(CustomField, id)
        if not f:
            return None
        if label is not None:
            f.label = label.strip()
        if options is not None:
            f.options_json = json.dumps(options or [])
        if on_card is not None:
            f.on_card = bool(on_card)
        session.add(f)
        session.commit()
        AuditService.log(session, 'UPDATE', 'Field', id)
        return _to_dict(f)

    @staticmethod
    def reorder(session: Session, ids: list):
        """Set sort order from a list of field ids (as displayed)."""
        for i, fid in enumerate(ids or []):
            f = session.get(CustomField, fid)
            if f:
                f.sort = i
                session.add(f)
        session.commit()
        return FieldService.grouped(session)

    @staticmethod
    def delete(session: Session, id: str):
        f = session.get(CustomField, id)
        if not f:
            return None
        session.delete(f)
        session.commit()
        AuditService.log(session, 'DELETE', 'Field', id)
        return {'ok': True}
