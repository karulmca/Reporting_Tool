import uuid
from sqlmodel import Session, select
from models import BoardColumn, WorkItemType, WorkItem, Framework, PodIteration, POD
from services.audit_service import AuditService


def _col(c: BoardColumn):
    return {'id': c.id, 'framework_id': c.framework_id, 'name': c.name, 'sort': c.sort,
            'wip_limit': c.wip_limit, 'is_done': c.is_done, 'color': c.color}


def _type(t: WorkItemType):
    return {'id': t.id, 'framework_id': t.framework_id, 'name': t.name, 'color': t.color, 'sort': t.sort}


def _fw(f: Framework):
    return {'id': f.id, 'name': f.name, 'iteration_label': f.iteration_label,
            'uses_sprints': f.uses_sprints, 'sprint_length_weeks': f.sprint_length_weeks,
            'swimlane': f.swimlane, 'sort': f.sort}


class BoardService:
    # ---- frameworks (each owns columns + types) ----------------------------
    @staticmethod
    def list_frameworks(session: Session):
        fws = sorted(session.exec(select(Framework)).all(), key=lambda x: x.sort)
        cols = sorted(session.exec(select(BoardColumn)).all(), key=lambda x: x.sort)
        types = sorted(session.exec(select(WorkItemType)).all(), key=lambda x: x.sort)
        out = []
        for f in fws:
            d = _fw(f)
            d['columns'] = [_col(c) for c in cols if c.framework_id == f.id]
            d['types'] = [_type(t) for t in types if t.framework_id == f.id]
            out.append(d)
        return out

    @staticmethod
    def create_framework(session: Session, name, iteration_label='Sprint', uses_sprints=True, sprint_length_weeks=2, swimlane=''):
        name = (name or '').strip()
        if not name:
            raise ValueError('Framework name required')
        nxt = len(session.exec(select(Framework)).all())
        f = Framework(id=uuid.uuid4().hex[:8], name=name, iteration_label=iteration_label or 'Sprint',
                      uses_sprints=bool(uses_sprints), sprint_length_weeks=int(sprint_length_weeks or 2),
                      swimlane=swimlane or '', sort=nxt)
        session.add(f)
        # seed a minimal default column set so the new framework is usable
        for s, (cn, done, color) in enumerate([('To Do', False, '#64748b'), ('In Progress', False, '#3b82f6'), ('Done', True, '#22c55e')]):
            session.add(BoardColumn(id=uuid.uuid4().hex[:8], framework_id=f.id, name=cn, sort=s, is_done=done, color=color))
        for s, (tn, color) in enumerate([('User Story', '#3b82f6'), ('Task', '#f59e0b'), ('Bug', '#ef4444')]):
            session.add(WorkItemType(id=uuid.uuid4().hex[:8], framework_id=f.id, name=tn, color=color, sort=s))
        session.commit()
        AuditService.log(session, 'CREATE', 'Framework', f.id)
        return _fw(f)

    @staticmethod
    def update_framework(session: Session, fid, **kw):
        f = session.get(Framework, fid)
        if not f:
            return None
        for k in ('name', 'iteration_label', 'swimlane'):
            if kw.get(k) is not None:
                setattr(f, k, kw[k])
        if kw.get('uses_sprints') is not None:
            f.uses_sprints = bool(kw['uses_sprints'])
        if kw.get('sprint_length_weeks') is not None:
            f.sprint_length_weeks = int(kw['sprint_length_weeks'] or 2)
        session.add(f); session.commit()
        AuditService.log(session, 'UPDATE', 'Framework', fid)
        return _fw(f)

    @staticmethod
    def delete_framework(session: Session, fid):
        f = session.get(Framework, fid)
        if not f:
            return None
        if session.exec(select(POD).where(POD.framework_id == fid)).first():
            raise ValueError('Framework is assigned to one or more PODs')
        if len(session.exec(select(Framework)).all()) <= 1:
            raise ValueError('At least one framework is required')
        for c in session.exec(select(BoardColumn).where(BoardColumn.framework_id == fid)).all():
            session.delete(c)
        for t in session.exec(select(WorkItemType).where(WorkItemType.framework_id == fid)).all():
            session.delete(t)
        session.delete(f); session.commit()
        AuditService.log(session, 'DELETE', 'Framework', fid)
        return {'ok': True}

    # ---- columns (framework-scoped) ----------------------------------------
    @staticmethod
    def create_column(session: Session, framework_id, name, wip_limit=0, is_done=False, color='#3b82f6'):
        name = (name or '').strip()
        if not name:
            raise ValueError('Column name required')
        if not session.get(Framework, framework_id):
            raise ValueError('Unknown framework')
        nxt = len([c for c in session.exec(select(BoardColumn)).all() if c.framework_id == framework_id])
        c = BoardColumn(id=uuid.uuid4().hex[:8], framework_id=framework_id, name=name, sort=nxt,
                        wip_limit=int(wip_limit or 0), is_done=bool(is_done), color=color or '#3b82f6')
        session.add(c); session.commit()
        AuditService.log(session, 'CREATE', 'BoardColumn', c.id)
        return _col(c)

    @staticmethod
    def update_column(session: Session, col_id, name=None, wip_limit=None, is_done=None, color=None):
        c = session.get(BoardColumn, col_id)
        if not c:
            return None
        if name is not None:
            c.name = name.strip()
        if wip_limit is not None:
            c.wip_limit = int(wip_limit or 0)
        if is_done is not None:
            c.is_done = bool(is_done)
        if color is not None:
            c.color = color
        session.add(c); session.commit()
        AuditService.log(session, 'UPDATE', 'BoardColumn', col_id)
        return _col(c)

    @staticmethod
    def delete_column(session: Session, col_id):
        c = session.get(BoardColumn, col_id)
        if not c:
            return None
        if session.exec(select(WorkItem).where(WorkItem.column_id == col_id)).first():
            raise ValueError('Column has work items — move or delete them first')
        siblings = [x for x in session.exec(select(BoardColumn)).all() if x.framework_id == c.framework_id]
        if len(siblings) <= 1:
            raise ValueError('A framework needs at least one column')
        session.delete(c); session.commit()
        AuditService.log(session, 'DELETE', 'BoardColumn', col_id)
        return {'ok': True}

    @staticmethod
    def reorder_columns(session: Session, ids):
        for i, cid in enumerate(ids or []):
            c = session.get(BoardColumn, cid)
            if c:
                c.sort = i; session.add(c)
        session.commit()
        return {'ok': True}

    # ---- work item types (framework-scoped) --------------------------------
    @staticmethod
    def create_type(session: Session, framework_id, name, color='#3b82f6'):
        name = (name or '').strip()
        if not name:
            raise ValueError('Type name required')
        if not session.get(Framework, framework_id):
            raise ValueError('Unknown framework')
        nxt = len([t for t in session.exec(select(WorkItemType)).all() if t.framework_id == framework_id])
        t = WorkItemType(id=uuid.uuid4().hex[:8], framework_id=framework_id, name=name, color=color or '#3b82f6', sort=nxt)
        session.add(t); session.commit()
        AuditService.log(session, 'CREATE', 'WorkItemType', t.id)
        return _type(t)

    @staticmethod
    def update_type(session: Session, type_id, name=None, color=None):
        t = session.get(WorkItemType, type_id)
        if not t:
            return None
        if name is not None:
            t.name = name.strip()
        if color is not None:
            t.color = color
        session.add(t); session.commit()
        AuditService.log(session, 'UPDATE', 'WorkItemType', type_id)
        return _type(t)

    @staticmethod
    def delete_type(session: Session, type_id):
        t = session.get(WorkItemType, type_id)
        if not t:
            return None
        if session.exec(select(WorkItem).where(WorkItem.type_id == type_id)).first():
            raise ValueError('Type is in use by work items')
        session.delete(t); session.commit()
        AuditService.log(session, 'DELETE', 'WorkItemType', type_id)
        return {'ok': True}

    # ---- per-POD iterations ------------------------------------------------
    @staticmethod
    def list_iterations(session: Session, pod=None):
        rows = session.exec(select(PodIteration)).all()
        if pod:
            rows = [r for r in rows if r.pod == pod]
        rows = sorted(rows, key=lambda r: (r.pod, r.sort, r.id or 0))
        return [{'id': r.id, 'pod': r.pod, 'name': r.name, 'sort': r.sort} for r in rows]

    @staticmethod
    def iterations_map(session: Session):
        out = {}
        for r in sorted(session.exec(select(PodIteration)).all(), key=lambda r: (r.sort, r.id or 0)):
            out.setdefault(r.pod, []).append(r.name)
        return out

    @staticmethod
    def add_iteration(session: Session, pod, name):
        pod = (pod or '').strip(); name = (name or '').strip()
        if not pod or not name:
            raise ValueError('POD and iteration name required')
        nxt = len([r for r in session.exec(select(PodIteration)).all() if r.pod == pod])
        r = PodIteration(pod=pod, name=name, sort=nxt)
        session.add(r); session.commit(); session.refresh(r)
        AuditService.log(session, 'CREATE', 'PodIteration', f'{pod}/{name}')
        return {'id': r.id, 'pod': r.pod, 'name': r.name, 'sort': r.sort}

    @staticmethod
    def delete_iteration(session: Session, iter_id):
        r = session.get(PodIteration, iter_id)
        if not r:
            return None
        session.delete(r); session.commit()
        AuditService.log(session, 'DELETE', 'PodIteration', str(iter_id))
        return {'ok': True}
