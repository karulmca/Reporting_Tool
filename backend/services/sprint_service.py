from sqlmodel import Session, select
from models import Sprint, Member, Idea
from services.audit_service import AuditService


def _to_dict(s: Sprint):
    # Field names match what the UI maps from: member_id -> member,
    # target_ideas -> targetIdeas.
    return {
        'member_id': s.member_id,
        'sprint': s.sprint,
        'committed': s.committed,
        'completed': s.completed,
        'target_ideas': s.target_ideas,
        'comments': s.comments,
    }


class SprintService:
    @staticmethod
    def list(session: Session):
        return [_to_dict(s) for s in session.exec(select(Sprint)).all()]

    @staticmethod
    def upsert(session: Session, member: str, sprint: str, committed,
               completed, target_ideas, comments: str):
        member = (member or '').strip()
        sprint = (sprint or '').strip()
        if not member or not sprint:
            raise ValueError('Member and sprint required')
        if not session.get(Member, member):
            raise ValueError(f'Unknown member Employee ID "{member}"')
        existing = session.exec(
            select(Sprint).where(Sprint.member_id == member, Sprint.sprint == sprint)
        ).first()
        action = 'UPDATE' if existing else 'CREATE'
        row = existing or Sprint(member_id=member, sprint=sprint)
        row.committed = float(committed or 0)
        row.completed = float(completed or 0)
        row.target_ideas = float(target_ideas or 0)
        row.comments = comments or ''
        session.add(row)
        session.commit()
        AuditService.log(session, action, 'Sprint', f'{member}|{sprint}')
        return _to_dict(row)

    @staticmethod
    def bulk_upsert(session: Session, rows):
        """Create or update many sprint entries from an uploaded sheet / Save All.
        Keyed on (member, sprint). Unknown members are skipped (row 1 = header)."""
        member_ids = {m.id for m in session.exec(select(Member)).all()}
        created = updated = 0
        errors = []
        for idx, r in enumerate(rows, start=2):
            member = (r.member or '').strip()
            sprint = (r.sprint or '').strip()
            if not member or not sprint:
                errors.append({'row': idx, 'error': 'Member (Emp ID) and Sprint are required'})
                continue
            if member not in member_ids:
                errors.append({'row': idx, 'error': f'Unknown member Employee ID "{member}"'})
                continue
            existing = session.exec(
                select(Sprint).where(Sprint.member_id == member, Sprint.sprint == sprint)
            ).first()
            row = existing or Sprint(member_id=member, sprint=sprint)
            row.committed = float(r.committed or 0)
            row.completed = float(r.completed or 0)
            row.target_ideas = float(r.targetIdeas or 0)
            if r.comments is not None:
                row.comments = r.comments or ''
            session.add(row)
            if existing:
                updated += 1
            else:
                created += 1
        session.commit()
        AuditService.log(session, 'UPSERT', 'Sprint', f'bulk +{created} / ~{updated}')
        return {'created': created, 'updated': updated, 'errors': errors, 'total': len(rows)}

    @staticmethod
    def delete(session: Session, member: str, sprint: str):
        row = session.exec(
            select(Sprint).where(Sprint.member_id == member, Sprint.sprint == sprint)
        ).first()
        if not row:
            return None
        session.delete(row)
        session.commit()
        AuditService.log(session, 'DELETE', 'Sprint', f'{member}|{sprint}')
        return {'ok': True}

    @staticmethod
    def rename(session: Session, old: str, new: str):
        """Rename a whole sprint period: move every member entry to the new name
        and re-map any ideas pointing at the old name. Members already present
        in the target sprint are skipped to avoid duplicates."""
        old = (old or '').strip()
        new = (new or '').strip()
        if not old or not new:
            raise ValueError('Both the current and new sprint names are required')
        rows = session.exec(select(Sprint).where(Sprint.sprint == old)).all()
        if not rows:
            return None
        if new == old:
            return {'ok': True, 'moved': 0, 'skipped': 0, 'ideas': 0}
        existing_new = {s.member_id for s in session.exec(select(Sprint).where(Sprint.sprint == new)).all()}
        moved = skipped = 0
        for r in rows:
            if r.member_id in existing_new:
                skipped += 1
                continue
            r.sprint = new
            session.add(r)
            moved += 1
        ideas = session.exec(select(Idea).where(Idea.sprint == old)).all()
        for i in ideas:
            i.sprint = new
            session.add(i)
        session.commit()
        AuditService.log(session, 'UPDATE', 'Sprint', f'{old} -> {new}')
        return {'ok': True, 'moved': moved, 'skipped': skipped, 'ideas': len(ideas)}

    @staticmethod
    def delete_by_sprint(session: Session, sprint: str):
        """Delete every member entry for a whole sprint period (e.g. 'Jan'26')."""
        rows = session.exec(select(Sprint).where(Sprint.sprint == sprint)).all()
        if not rows:
            return None
        for r in rows:
            session.delete(r)
        session.commit()
        AuditService.log(session, 'DELETE', 'Sprint', f'{sprint} (x{len(rows)})')
        return {'ok': True, 'deleted': len(rows)}
