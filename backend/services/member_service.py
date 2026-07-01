import json
from sqlmodel import Session, select
from models import Member, POD
from services.audit_service import AuditService


def _to_dict(m: Member):
    return {
        'id': m.id,
        'name': m.name,
        'pod': m.pod,
        'sl': m.sl,
        'country': m.country,
        'target': m.target,
        'custom': json.loads(m.custom_json or '{}'),
    }


class MemberService:
    @staticmethod
    def list(session: Session):
        return [_to_dict(m) for m in session.exec(select(Member)).all()]

    @staticmethod
    def create(session: Session, id: str, name: str, pod: str, sl: str, target, custom: dict, country=None):
        id = (id or '').strip()
        if not id or not (name or '').strip():
            raise ValueError('Member id and name required')
        if session.get(Member, id):
            raise ValueError('Member id already exists')
        m = Member(
            id=id, name=name.strip(), pod=pod or '', sl=sl or 'M&E',
            country=(country or '').strip(),
            target=int(target) if target is not None else 12,
            custom_json=json.dumps(custom or {}),
        )
        session.add(m)
        session.commit()
        AuditService.log(session, 'CREATE', 'Member', id)
        return _to_dict(m)

    @staticmethod
    def update(session: Session, id: str, name=None, pod=None, sl=None, target=None, custom=None, country=None):
        m = session.get(Member, id)
        if not m:
            return None
        if name is not None:
            m.name = name
        if pod is not None:
            m.pod = pod
        if sl is not None:
            m.sl = sl
        if country is not None:
            m.country = country
        if target is not None:
            m.target = int(target)
        if custom is not None:
            m.custom_json = json.dumps(custom)
        session.add(m)
        session.commit()
        AuditService.log(session, 'UPDATE', 'Member', id)
        return _to_dict(m)

    @staticmethod
    def delete(session: Session, id: str):
        m = session.get(Member, id)
        if not m:
            return None
        session.delete(m)
        session.commit()
        AuditService.log(session, 'DELETE', 'Member', id)
        return {'ok': True}

    @staticmethod
    def bulk_upsert(session: Session, rows):
        """Create or update many members from an uploaded sheet.

        Rows are MemberIn objects. Existing employee ids are updated, new ones
        created. Returns a per-row summary; bad rows are skipped, not fatal.
        Row numbers start at 2 to match the spreadsheet (row 1 = header).
        """
        pod_codes = {p.code for p in session.exec(select(POD)).all()}
        created = updated = 0
        errors = []
        for idx, r in enumerate(rows, start=2):
            rid = (r.id or '').strip()
            name = (r.name or '').strip()
            if not rid or not name:
                errors.append({'row': idx, 'error': 'Employee ID and Full Name are required'})
                continue
            pod = (r.pod or '').strip()
            if pod and pod not in pod_codes:
                errors.append({'row': idx, 'error': f'Unknown POD "{pod}"'})
                continue
            target = int(r.target) if r.target is not None else 12
            country = (getattr(r, 'country', None) or '').strip()
            m = session.get(Member, rid)
            if m:
                m.name = name
                if pod:
                    m.pod = pod
                m.sl = r.sl or m.sl
                m.target = target
                if country:
                    m.country = country
                if r.custom is not None:
                    m.custom_json = json.dumps(r.custom)
                updated += 1
            else:
                m = Member(id=rid, name=name, pod=pod, sl=r.sl or 'M&E',
                           country=country, target=target, custom_json=json.dumps(r.custom or {}))
                created += 1
            session.add(m)
        session.commit()
        AuditService.log(session, 'UPSERT', 'Member', f'bulk +{created} / ~{updated}')
        return {'created': created, 'updated': updated, 'errors': errors, 'total': len(rows)}
