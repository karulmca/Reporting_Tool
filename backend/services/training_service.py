import uuid
from sqlmodel import Session, select
from models import TrainingCourse, TrainingStatus, TrainingStatusOption
from services.audit_service import AuditService


class TrainingService:
    @staticmethod
    def list_courses(session: Session):
        return [
            {'id': c.id, 'name': c.name}
            for c in session.exec(select(TrainingCourse)).all()
        ]

    @staticmethod
    def add_course(session: Session, id: str, name: str):
        id = (id or '').strip()
        if not id:
            raise ValueError('Course id required')
        if session.get(TrainingCourse, id):
            raise ValueError('Course id already exists')
        c = TrainingCourse(id=id, name=name or id)
        session.add(c)
        session.commit()
        AuditService.log(session, 'CREATE', 'Course', id)
        return {'id': c.id, 'name': c.name}

    @staticmethod
    def update_course(session: Session, id: str, name: str):
        c = session.get(TrainingCourse, id)
        if not c:
            return None
        c.name = name or c.name
        session.add(c)
        session.commit()
        AuditService.log(session, 'UPDATE', 'Course', id)
        return {'id': c.id, 'name': c.name}

    @staticmethod
    def delete_course(session: Session, id: str):
        c = session.get(TrainingCourse, id)
        if not c:
            return None
        # Remove the course and any member statuses recorded against it.
        for st in session.exec(select(TrainingStatus).where(TrainingStatus.course_id == id)).all():
            session.delete(st)
        session.delete(c)
        session.commit()
        AuditService.log(session, 'DELETE', 'Course', id)
        return {'ok': True}

    # ---- Status options (admin-configurable matrix values) ----------------
    @staticmethod
    def list_status_options(session: Session):
        rows = session.exec(select(TrainingStatusOption)).all()
        rows = sorted(rows, key=lambda o: (o.sort, o.label))
        return [{'id': o.id, 'label': o.label, 'color': o.color, 'sort': o.sort} for o in rows]

    @staticmethod
    def add_status_option(session: Session, label: str, color: str):
        label = (label or '').strip()
        if not label:
            raise ValueError('Status label required')
        existing = session.exec(select(TrainingStatusOption)).all()
        if any(o.label.lower() == label.lower() for o in existing):
            raise ValueError(f'Status "{label}" already exists')
        nxt = (max([o.sort for o in existing], default=-1)) + 1
        o = TrainingStatusOption(id=uuid.uuid4().hex[:8], label=label, color=color or '#5e6a82', sort=nxt)
        session.add(o)
        session.commit()
        AuditService.log(session, 'CREATE', 'StatusOption', label)
        return {'id': o.id, 'label': o.label, 'color': o.color, 'sort': o.sort}

    @staticmethod
    def update_status_option(session: Session, id: str, label: str, color: str):
        o = session.get(TrainingStatusOption, id)
        if not o:
            return None
        old_label = o.label
        if label is not None:
            o.label = label.strip() or o.label
        if color is not None:
            o.color = color
        session.add(o)
        # Cascade a rename to existing member statuses so nothing is orphaned.
        if o.label != old_label:
            for st in session.exec(select(TrainingStatus).where(TrainingStatus.status == old_label)).all():
                st.status = o.label
                session.add(st)
        session.commit()
        AuditService.log(session, 'UPDATE', 'StatusOption', o.label)
        return {'id': o.id, 'label': o.label, 'color': o.color, 'sort': o.sort}

    @staticmethod
    def delete_status_option(session: Session, id: str):
        o = session.get(TrainingStatusOption, id)
        if not o:
            return None
        session.delete(o)
        session.commit()
        AuditService.log(session, 'DELETE', 'StatusOption', o.label)
        return {'ok': True}

    @staticmethod
    def status_map(session: Session):
        """Return nested dict {memberId: {courseId: status}}."""
        out = {}
        for s in session.exec(select(TrainingStatus)).all():
            out.setdefault(s.member_id, {})[s.course_id] = s.status
        return out

    @staticmethod
    def set_status(session: Session, member_id: str, course_id: str, status: str):
        member_id = (member_id or '').strip()
        course_id = (course_id or '').strip()
        if not member_id or not course_id:
            raise ValueError('memberId and courseId required')
        existing = session.exec(
            select(TrainingStatus).where(
                TrainingStatus.member_id == member_id,
                TrainingStatus.course_id == course_id,
            )
        ).first()
        row = existing or TrainingStatus(member_id=member_id, course_id=course_id)
        row.status = status or ''
        session.add(row)
        session.commit()
        AuditService.log(session, 'UPSERT', 'Training', f'{member_id}|{course_id}')
        return {'ok': True}
