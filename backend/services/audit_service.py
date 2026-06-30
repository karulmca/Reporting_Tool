from datetime import datetime
from sqlmodel import Session, select
from models import AuditLog


class AuditService:
    @staticmethod
    def log(session: Session, action: str, entity: str, entity_id):
        entry = AuditLog(
            ts=datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            action=action,
            entity=entity,
            entity_id=str(entity_id),
        )
        session.add(entry)
        session.commit()

    @staticmethod
    def list(session: Session, limit: int = 200):
        rows = session.exec(
            select(AuditLog).order_by(AuditLog.id.desc()).limit(limit)
        ).all()
        return [
            {'ts': r.ts, 'action': r.action, 'entity': r.entity, 'entity_id': r.entity_id}
            for r in rows
        ]
