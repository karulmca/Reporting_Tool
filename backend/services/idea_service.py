import json
import uuid
import re
from sqlmodel import Session, select
from models import Idea, Member
from services.audit_service import AuditService

ALLOWED_STATUS = {'Implemented', 'In Progress', 'POC Stage', 'Proposed', 'New', 'Ideation'}

# Map the source "Stage of the Idea" values onto the app's status set so the
# dashboards (which count 'Implemented' etc.) keep working. The raw stage is
# always preserved separately on the record.
STAGE_TO_STATUS = {
    'approved for implementation': 'POC Stage',
    'implementation in progress': 'In Progress',
    'implemented': 'Implemented',
    'completed': 'Implemented',
    'on-hold': 'Proposed',
    'on hold': 'Proposed',
    'rejected': 'Proposed',
    'new': 'New',
    'ideation': 'Ideation',
    'proposed': 'Proposed',
}

_EMP_RE = re.compile(r'\((\d+)\)\s*$')


def map_stage(stage: str, fallback_status: str = '') -> str:
    """Resolve an app status from a raw stage, falling back to an explicit
    status value, then to 'Proposed'."""
    s = (stage or '').strip().lower()
    if s in STAGE_TO_STATUS:
        return STAGE_TO_STATUS[s]
    if fallback_status in ALLOWED_STATUS:
        return fallback_status
    return 'Proposed'


def parse_emp(text: str):
    """Split a 'Surname,Given(123456)' string into (employee_id, name)."""
    text = (text or '').strip()
    m = _EMP_RE.search(text)
    if m:
        return m.group(1), text[:text.rfind('(')].strip()
    return '', text


def _to_dict(i: Idea):
    return {
        'id': i.id,
        'idea_id': i.idea_id,
        'title': i.title,
        'problem': i.problem,
        'description': i.description,
        'submitter': i.submitter,
        'submitter_name': i.submitter_name,
        'contributors': i.contributors,
        'status': i.status,
        'stage': i.stage,
        'workflow': i.workflow,
        'source': i.source,
        'project_name': i.project_name,
        'solution': i.solution,
        'benefit': i.benefit,
        'competency': i.competency,
        'tags': i.tags,
        'created_on': i.created_on,
        'rating': i.rating,
        'savings_type': i.savings_type,
        'savings_amount': i.savings_amount,
        'sprint': i.sprint,
        'comments': i.comments,
        'custom': json.loads(i.custom_json or '{}'),
    }


def _sync_member_name(members: dict, emp_id: str, name: str):
    """If the employee id is already a known member, refresh their display name
    from the sheet. New (unknown) ids are NOT created."""
    if emp_id and name and emp_id in members and members[emp_id].name != name:
        members[emp_id].name = name
        return members[emp_id]
    return None


class IdeaService:
    @staticmethod
    def list(session: Session):
        return [_to_dict(i) for i in session.exec(select(Idea)).all()]

    @staticmethod
    def create(session: Session, title: str, problem: str, desc: str,
               submitter: str, contributors: str, status: str, custom: dict,
               sprint: str = '', **extra):
        if not (title or '').strip():
            raise ValueError('Idea title required')
        member_ids = {m.id for m in session.exec(select(Member)).all()}
        sub = (submitter or '').strip()
        if not sub:
            raise ValueError('Submitter (Employee ID) is required')
        # Manually-added ideas still require a known member as submitter.
        if sub not in member_ids:
            raise ValueError(f'Unknown submitter Employee ID "{sub}"')
        idea_id = (extra.get('idea_id') or '').strip()
        if not idea_id:
            raise ValueError('Idea ID is required')
        if session.exec(select(Idea).where(Idea.submitter == sub, Idea.idea_id == idea_id)).first():
            raise ValueError(f'An idea with ID "{idea_id}" already exists for this submitter')
        stage = (extra.get('stage') or '').strip()
        i = Idea(
            id=f'{sub}-{idea_id}',
            idea_id=idea_id,
            title=title.strip(),
            problem=problem or '',
            description=desc or '',
            submitter=sub,
            submitter_name=(extra.get('submitter_name') or '').strip(),
            contributors=(contributors or '').strip(),
            status=map_stage(stage, status or 'Proposed'),
            stage=stage,
            workflow=(extra.get('workflow') or '').strip(),
            source=(extra.get('source') or '').strip(),
            project_name=(extra.get('project_name') or '').strip(),
            solution=extra.get('solution') or '',
            benefit=extra.get('benefit') or '',
            competency=(extra.get('competency') or '').strip(),
            tags=(extra.get('tags') or '').strip(),
            created_on=(extra.get('created_on') or '').strip(),
            rating=float(extra.get('rating') or 0),
            savings_type=(extra.get('savings_type') or '').strip(),
            savings_amount=float(extra.get('savings_amount') or 0),
            sprint=(sprint or '').strip(),
            comments=extra.get('comments') or '',
            custom_json=json.dumps(custom or {}),
        )
        session.add(i)
        session.commit()
        AuditService.log(session, 'CREATE', 'Idea', i.id)
        return _to_dict(i)

    @staticmethod
    def update(session: Session, id: str, title=None, status=None,
               problem=None, desc=None, custom=None, sprint=None, **extra):
        i = session.get(Idea, id)
        if not i:
            return None
        if title is not None:
            i.title = title
        if problem is not None:
            i.problem = problem
        if desc is not None:
            i.description = desc
        if sprint is not None:
            i.sprint = sprint.strip()
        if custom is not None:
            i.custom_json = json.dumps(custom)
        for fld in ('workflow', 'source', 'project_name', 'solution', 'benefit',
                    'competency', 'tags', 'created_on', 'contributors', 'submitter_name',
                    'savings_type', 'comments'):
            if fld in extra and extra[fld] is not None:
                setattr(i, fld, extra[fld])
        if 'rating' in extra and extra['rating'] is not None:
            i.rating = float(extra['rating'] or 0)
        if 'savings_amount' in extra and extra['savings_amount'] is not None:
            i.savings_amount = float(extra['savings_amount'] or 0)
        # Stage and status: keep both. Changing the stage re-derives the mapped
        # status; if the stage is unchanged, a manual status edit is honoured.
        stage = extra.get('stage')
        if stage is not None and stage != i.stage:
            i.stage = stage
            i.status = map_stage(stage, status if status is not None else i.status)
        else:
            if stage is not None:
                i.stage = stage
            if status is not None and status in ALLOWED_STATUS:
                i.status = status
        session.add(i)
        session.commit()
        AuditService.log(session, 'UPDATE', 'Idea', id)
        return _to_dict(i)

    @staticmethod
    def delete(session: Session, id: str):
        i = session.get(Idea, id)
        if not i:
            return None
        session.delete(i)
        session.commit()
        AuditService.log(session, 'DELETE', 'Idea', id)
        return {'ok': True}

    @staticmethod
    def bulk_upsert(session: Session, rows):
        """Create or update many ideas from an uploaded sheet.

        The business key is (submitter employee id, idea_id): a row whose pair
        already exists is updated in place, otherwise a new idea is created.
        Existing members whose id appears in the sheet have their display name
        refreshed; unknown ids are NOT added as members. Row numbers start at 2
        (header = row 1). Bad rows are skipped, not fatal.
        """
        members = {m.id: m for m in session.exec(select(Member)).all()}
        created = updated = 0
        errors = []
        touched_members = set()
        for idx, r in enumerate(rows, start=2):
            idea_id = (r.idea_id or '').strip()
            submitter = (r.submitter or '').strip()
            title = (r.title or '').strip()
            if not idea_id:
                errors.append({'row': idx, 'error': 'Idea ID is required'})
                continue
            if not submitter:
                errors.append({'row': idx, 'error': 'Submitter Employee ID is required'})
                continue
            if not title:
                errors.append({'row': idx, 'error': 'Idea Title is required'})
                continue

            # Refresh the submitter's name on the matching member, if any.
            m = _sync_member_name(members, submitter, (r.submitter_name or '').strip())
            if m is not None:
                session.add(m)
                touched_members.add(submitter)

            stage = (r.stage or '').strip()
            status = map_stage(stage, r.status or 'Proposed')
            existing = session.exec(
                select(Idea).where(Idea.submitter == submitter, Idea.idea_id == idea_id)
            ).first()
            target = existing or Idea(id=f'{submitter}-{idea_id}', idea_id=idea_id, submitter=submitter)
            target.title = title
            target.problem = r.problem or ''
            target.description = r.desc or ''
            target.submitter_name = (r.submitter_name or '').strip()
            target.contributors = (r.contributors or '').strip()
            target.status = status
            target.stage = stage
            target.workflow = (r.workflow or '').strip()
            target.source = (r.source or '').strip()
            target.project_name = (r.project_name or '').strip()
            target.solution = r.solution or ''
            target.benefit = r.benefit or ''
            target.competency = (r.competency or '').strip()
            target.tags = (r.tags or '').strip()
            target.created_on = (r.created_on or '').strip()
            target.rating = float(r.rating or 0)
            target.savings_type = (r.savings_type or '').strip()
            target.savings_amount = float(r.savings_amount or 0)
            target.comments = r.comments or ''
            # The export has no Sprint column; keep any manually-assigned sprint.
            if (r.sprint or '').strip():
                target.sprint = r.sprint.strip()
            if r.custom is not None:
                target.custom_json = json.dumps(r.custom)
            session.add(target)
            if existing:
                updated += 1
            else:
                created += 1
        session.commit()
        AuditService.log(session, 'UPSERT', 'Idea',
                         f'bulk +{created} / ~{updated} (members ~{len(touched_members)})')
        return {'created': created, 'updated': updated, 'errors': errors,
                'total': len(rows), 'members_updated': len(touched_members)}
