import os
import json
from sqlmodel import SQLModel, Session, create_engine, select
from sqlalchemy import text

from models import (
    POD, Member, Idea, Sprint, TrainingCourse, TrainingStatus, TrainingStatusOption,
    DefectRecord, CustomField, BoardColumn, WorkItemType, BoardSetting, WorkItem, WorkItemUpdate,
    Framework, PodIteration,
)

# Absolute path so the DB / backup work regardless of the current directory.
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_FILE = os.path.join(BASE_DIR, 'bluebolt.db')
DATABASE_URL = f'sqlite:///{DB_FILE}'

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})


DEFAULT_STATUS_OPTIONS = [
    ('Completed', '#22c55e'),
    ('In-Progress', '#3b82f6'),
    ('Yet Start', '#f59e0b'),
    ('Select', '#8b5cf6'),
    ('Error', '#ef4444'),
]


def init_db():
    SQLModel.metadata.create_all(engine)
    ensure_schema()
    seed_demo_data()
    seed_status_options()
    seed_defects()
    purge_invalid_ideas()
    seed_board()


def ensure_schema():
    """Lightweight migrations: add columns introduced after a table first existed.

    create_all() only creates missing tables, never alters existing ones, so new
    columns on an existing SQLite DB must be added explicitly.
    """
    additions = {
        'idea': [
            ('sprint', "TEXT DEFAULT ''"),
            ('idea_id', "TEXT DEFAULT ''"),
            ('submitter_name', "TEXT DEFAULT ''"),
            ('stage', "TEXT DEFAULT ''"),
            ('workflow', "TEXT DEFAULT ''"),
            ('source', "TEXT DEFAULT ''"),
            ('project_name', "TEXT DEFAULT ''"),
            ('solution', "TEXT DEFAULT ''"),
            ('benefit', "TEXT DEFAULT ''"),
            ('competency', "TEXT DEFAULT ''"),
            ('tags', "TEXT DEFAULT ''"),
            ('created_on', "TEXT DEFAULT ''"),
            ('rating', "REAL DEFAULT 0"),
            ('savings_type', "TEXT DEFAULT ''"),
            ('savings_amount', "REAL DEFAULT 0"),
            ('comments', "TEXT DEFAULT ''"),
        ],
        'defectrecord': [
            ('status', "TEXT DEFAULT 'Open'"),
            ('rca_category', "TEXT DEFAULT ''"),
            ('rca_status', "TEXT DEFAULT 'Not Started'"),
            ('rca', "TEXT DEFAULT ''"),
        ],
        'customfield': [
            ('on_card', 'INTEGER DEFAULT 0'),
            ('sort', 'INTEGER DEFAULT 0'),
        ],
        'pod': [('framework_id', "TEXT DEFAULT ''")],
        'boardcolumn': [('framework_id', "TEXT DEFAULT ''")],
        'workitemtype': [('framework_id', "TEXT DEFAULT ''")],
    }
    with engine.connect() as conn:
        for table, cols in additions.items():
            existing = {row[1] for row in conn.execute(text(f'PRAGMA table_info({table})'))}
            for name, decl in cols:
                if name not in existing:
                    conn.execute(text(f'ALTER TABLE {table} ADD COLUMN {name} {decl}'))
        conn.commit()


def seed_status_options():
    """Seed the default training status options once (independent of demo data)."""
    import uuid
    with Session(engine) as session:
        if session.exec(select(TrainingStatusOption)).first():
            return
        for i, (label, color) in enumerate(DEFAULT_STATUS_OPTIONS):
            session.add(TrainingStatusOption(id=uuid.uuid4().hex[:8], label=label, color=color, sort=i))
        session.commit()


def seed_demo_data():
    """Populate a small demo dataset the first time the app runs."""
    with Session(engine) as session:
        if session.exec(select(POD)).first():
            return  # already seeded / has data

        pods = [
            POD(code='FE', name='Frontend POD', sl='M&E', color='#3b82f6'),
            POD(code='BE', name='Backend POD', sl='M&E', color='#22c55e'),
            POD(code='QA', name='Quality POD', sl='M&E', color='#f59e0b'),
        ]
        members = [
            Member(id='2012144', name='Kuppusamy, Arul', pod='BE', sl='M&E', target=12),
            Member(id='304951', name='Sharma, Priya', pod='FE', sl='M&E', target=10),
            Member(id='716949', name='Reddy, Karthik', pod='FE', sl='M&E', target=8),
            Member(id='588213', name='Iyer, Meera', pod='BE', sl='M&E', target=12),
            Member(id='990217', name='Nair, Sanjay', pod='QA', sl='M&E', target=6),
        ]
        ideas = [
            Idea(id='a1b2c3d4', idea_id='DEMO-001', title='Automated Regression Suite',
                 problem='Manual regression takes 2 days each release.',
                 description='Build a CI-triggered automated regression suite to cut release time.',
                 submitter='990217', contributors='588213', status='Implemented'),
            Idea(id='b2c3d4e5', idea_id='DEMO-002', title='Self-service Reporting Portal',
                 problem='Stakeholders email for ad-hoc reports.',
                 description='A portal where stakeholders pull their own reports.',
                 submitter='2012144', contributors='588213,304951', status='In Progress'),
            Idea(id='c3d4e5f6', idea_id='DEMO-003', title='Design System Component Library',
                 problem='Inconsistent UI across screens.',
                 description='Shared, themeable component library for all front-end teams.',
                 submitter='304951', contributors='716949', status='POC Stage'),
            Idea(id='d4e5f6a7', idea_id='DEMO-004', title='Smart Log Anomaly Alerts',
                 problem='Production issues found too late.',
                 description='ML-based anomaly detection on application logs.',
                 submitter='588213', contributors='', status='Proposed'),
            Idea(id='e5f6a7b8', idea_id='DEMO-005', title='One-click Environment Spin-up',
                 problem='Setting up a dev environment takes hours.',
                 description='Scripted, containerised environment provisioning.',
                 submitter='716949', contributors='2012144', status='New'),
        ]
        sprints = [
            Sprint(member_id='2012144', sprint="May'26", committed=20, completed=18, target_ideas=1, comments='On track'),
            Sprint(member_id='304951', sprint="May'26", committed=16, completed=16, target_ideas=1, comments=''),
            Sprint(member_id='716949', sprint="May'26", committed=14, completed=10, target_ideas=1, comments='Blocked mid-sprint'),
            Sprint(member_id='2012144', sprint="June'26", committed=22, completed=20, target_ideas=1, comments=''),
            Sprint(member_id='588213', sprint="June'26", committed=18, completed=15, target_ideas=1, comments=''),
            Sprint(member_id='990217', sprint="June'26", committed=12, completed=12, target_ideas=1, comments='Great sprint'),
        ]
        courses = [
            TrainingCourse(id='ELRNG01555', name='Secure Coding Fundamentals'),
            TrainingCourse(id='ELRNG02340', name='Cloud Architecture Basics'),
        ]
        statuses = [
            TrainingStatus(member_id='2012144', course_id='ELRNG01555', status='Completed'),
            TrainingStatus(member_id='304951', course_id='ELRNG01555', status='In-Progress'),
            TrainingStatus(member_id='716949', course_id='ELRNG02340', status='Yet Start'),
        ]

        for row in pods + members + ideas + sprints + courses + statuses:
            session.add(row)
        session.commit()


def purge_invalid_ideas():
    """Enforce the idea key invariant: every idea must have both an idea_id and
    a submitter (employee id). Any record missing either is removed. Runs on
    every startup so the rule holds continuously (valid rows always have both)."""
    with Session(engine) as session:
        rows = session.exec(
            select(Idea).where((Idea.idea_id == '') | (Idea.submitter == ''))
        ).all()
        for r in rows:
            session.delete(r)
        if rows:
            session.commit()
            print(f'[startup] purged {len(rows)} idea(s) missing idea_id/submitter')
        return len(rows)


# Framework catalogue: (name, iteration_label, uses_sprints, sprint_weeks)
FRAMEWORKS = [
    ('Scrum', 'Sprint', True, 2),
    ('Kanban', 'Iteration', False, 2),
    ('Scrumban', 'Sprint', True, 2),
    ('SAFe', 'PI', True, 2),
    ('LeSS', 'Sprint', True, 2),
    ('Nexus', 'Sprint', True, 2),
    ('Scrum@Scale', 'Sprint', True, 2),
    ('Disciplined Agile', 'Iteration', True, 2),
    ('Spotify', 'Sprint', True, 2),
]
# Per-framework default columns: (name, wip_limit, is_done, color)
SCRUM_COLS = [('New', 0, False, '#64748b'), ('Active', 0, False, '#3b82f6'), ('Resolved', 0, False, '#f59e0b'), ('Closed', 0, True, '#22c55e')]
KANBAN_COLS = [('Backlog', 0, False, '#64748b'), ('To Do', 5, False, '#3b82f6'), ('In Progress', 3, False, '#f59e0b'), ('Review', 3, False, '#a855f7'), ('Done', 0, True, '#22c55e')]
SCRUMBAN_COLS = [('To Do', 0, False, '#64748b'), ('In Progress', 3, False, '#3b82f6'), ('Review', 3, False, '#f59e0b'), ('Done', 0, True, '#22c55e')]
SAFE_COLS = [('Funnel', 0, False, '#64748b'), ('Analyzing', 0, False, '#3b82f6'), ('Backlog', 0, False, '#06b6d4'), ('Implementing', 0, False, '#f59e0b'), ('Validating', 0, False, '#a855f7'), ('Done', 0, True, '#22c55e')]
COLS_BY_FW = {'Kanban': KANBAN_COLS, 'Scrumban': SCRUMBAN_COLS, 'SAFe': SAFE_COLS}
DEFAULT_WI_TYPES = [('User Story', '#3b82f6'), ('Task', '#f59e0b'), ('Bug', '#ef4444')]


def seed_board():
    """Seed frameworks + their board templates, migrate any legacy global board
    under a default 'Scrum' framework, and map unmapped PODs to it."""
    import uuid
    with Session(engine) as session:
        # 1) Frameworks
        existing_fw = {f.name: f for f in session.exec(select(Framework)).all()}
        for i, (name, label, uses, weeks) in enumerate(FRAMEWORKS):
            if name not in existing_fw:
                f = Framework(id=uuid.uuid4().hex[:8], name=name, iteration_label=label,
                              uses_sprints=uses, sprint_length_weeks=weeks, sort=i)
                session.add(f); existing_fw[name] = f
        session.commit()
        fw = {f.name: f.id for f in session.exec(select(Framework)).all()}
        scrum_id = fw['Scrum']

        # 2) Migrate any legacy (frameworkless) columns/types under Scrum
        for c in session.exec(select(BoardColumn)).all():
            if not c.framework_id:
                c.framework_id = scrum_id; session.add(c)
        for t in session.exec(select(WorkItemType)).all():
            if not t.framework_id:
                t.framework_id = scrum_id; session.add(t)
        session.commit()

        # 3) Seed columns + types per framework where missing
        all_cols = session.exec(select(BoardColumn)).all()
        all_types = session.exec(select(WorkItemType)).all()
        for name, fid in fw.items():
            if not any(c.framework_id == fid for c in all_cols):
                tmpl = COLS_BY_FW.get(name, SCRUM_COLS)
                for s, (cn, wip, done, color) in enumerate(tmpl):
                    session.add(BoardColumn(id=uuid.uuid4().hex[:8], framework_id=fid, name=cn, sort=s, wip_limit=wip, is_done=done, color=color))
            if not any(t.framework_id == fid for t in all_types):
                for s, (tn, color) in enumerate(DEFAULT_WI_TYPES):
                    session.add(WorkItemType(id=uuid.uuid4().hex[:8], framework_id=fid, name=tn, color=color, sort=s))
        session.commit()

        # 4) Map unmapped PODs to Scrum
        for p in session.exec(select(POD)).all():
            if not p.framework_id:
                p.framework_id = scrum_id; session.add(p)
        session.commit()

        # 5) Demo work items (fresh DB only)
        if not session.exec(select(WorkItem)).first():
            members = session.exec(select(Member)).all()
            sprints = session.exec(select(Sprint)).all()
            cols = [c for c in session.exec(select(BoardColumn)).all() if c.framework_id == scrum_id]
            types = [t for t in session.exec(select(WorkItemType)).all() if t.framework_id == scrum_id]
            cols.sort(key=lambda c: c.sort)
            if cols and types and members and sprints:
                sprint = sprints[-1].sprint
                samples = [('Set up CI pipeline', 'High', 5), ('Fix login regression', 'Critical', 3),
                           ('Design dashboard wireframe', 'Medium', 2), ('Write API integration tests', 'Medium', 5),
                           ('Investigate slow query', 'High', 3)]
                for i, (title, prio, pts) in enumerate(samples):
                    m = members[i % len(members)]
                    session.add(WorkItem(title=title, type_id=types[i % len(types)].id, column_id=cols[i % len(cols)].id,
                                         rank=float(i), assignee=m.id, sprint=sprint, pod=m.pod, priority=prio, story_points=pts, tags=''))
                session.commit()


def seed_defects():
    """Seed demo post-production defect records once (independent of demo data),
    so the Defect Density report has something to show on existing databases."""
    with Session(engine) as session:
        if session.exec(select(DefectRecord)).first():
            return
        rows = [
            DefectRecord(release='R2026.1', sprint="May'26", pod='FE', critical=1, high=3, medium=5, low=8, comments='Login regression'),
            DefectRecord(release='R2026.1', sprint="May'26", pod='BE', critical=0, high=2, medium=4, low=6, comments=''),
            DefectRecord(release='R2026.1', sprint="May'26", pod='QA', critical=0, high=1, medium=2, low=3, comments=''),
            DefectRecord(release='R2026.2', sprint="June'26", pod='FE', critical=0, high=1, medium=3, low=5, comments='Improved after hardening'),
            DefectRecord(release='R2026.2', sprint="June'26", pod='BE', critical=1, high=1, medium=2, low=4, comments=''),
            DefectRecord(release='R2026.2', sprint="June'26", pod='QA', critical=0, high=0, medium=1, low=2, comments=''),
        ]
        for row in rows:
            session.add(row)
        session.commit()
