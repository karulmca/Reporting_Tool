from sqlmodel import Session, select
from models import POD, Member
from services.audit_service import AuditService


def _to_dict(p: POD):
    return {'code': p.code, 'name': p.name, 'sl': p.sl, 'color': p.color, 'framework_id': p.framework_id}


class PODService:
    @staticmethod
    def list(session: Session):
        return [_to_dict(p) for p in session.exec(select(POD)).all()]

    @staticmethod
    def create(session: Session, code: str, name: str, sl: str, color: str):
        code = (code or '').strip().upper()
        if not code:
            raise ValueError('POD code required')
        if session.get(POD, code):
            raise ValueError('POD code already exists')
        p = POD(code=code, name=name or code, sl=sl or 'M&E', color=color or '#3b82f6')
        session.add(p)
        session.commit()
        AuditService.log(session, 'CREATE', 'POD', code)
        return _to_dict(p)

    @staticmethod
    def update(session: Session, code: str, name=None, sl=None, color=None, framework_id=None):
        p = session.get(POD, code)
        if not p:
            return None
        if name is not None:
            p.name = name
        if sl is not None:
            p.sl = sl
        if color is not None:
            p.color = color
        if framework_id is not None:
            p.framework_id = framework_id
        session.add(p)
        session.commit()
        AuditService.log(session, 'UPDATE', 'POD', code)
        return _to_dict(p)

    @staticmethod
    def delete(session: Session, code: str):
        p = session.get(POD, code)
        if not p:
            return None
        if session.exec(select(Member).where(Member.pod == code)).first():
            raise ValueError('Cannot remove: POD has members')
        session.delete(p)
        session.commit()
        AuditService.log(session, 'DELETE', 'POD', code)
        return {'ok': True}
