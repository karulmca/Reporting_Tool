from typing import Optional
from sqlmodel import SQLModel, Field
from sqlalchemy import Column, Text

# ---------------------------------------------------------------------------
# BlueBolt Innovation Tracker - data model
#
# The schema mirrors exactly what the single-page UI (static/index.html)
# expects from the REST API. Custom field values and dropdown options are
# stored as JSON strings in SQLite Text columns.
# ---------------------------------------------------------------------------


class POD(SQLModel, table=True):
    """A team / POD. Identified by a short human code (e.g. FE, BE, QA)."""
    code: str = Field(primary_key=True)
    name: str = ''
    sl: str = 'M&E'          # service line
    color: str = '#3b82f6'
    framework_id: str = ''   # which scaling framework this POD runs


class Member(SQLModel, table=True):
    """A team member. id is the employee id (string)."""
    id: str = Field(primary_key=True)
    name: str = ''
    pod: str = ''
    sl: str = 'M&E'
    target: int = 12          # annual idea target
    custom_json: str = Field(default='{}', sa_column=Column(Text))


class Idea(SQLModel, table=True):
    """An idea / innovation.

    Uploaded rows are keyed on (submitter, idea_id): the employee id of the
    submitter plus the source "Idea ID". A re-upload with the same pair updates
    the existing record rather than creating a duplicate.
    """
    id: str = Field(primary_key=True)
    idea_id: str = ''          # source "Idea ID" (unique business key with submitter)
    title: str = ''
    problem: str = Field(default='', sa_column=Column(Text))
    description: str = Field(default='', sa_column=Column(Text))
    submitter: str = ''        # submitter employee id
    submitter_name: str = ''   # submitter display name (from the sheet)
    contributors: str = Field(default='', sa_column=Column(Text))  # raw "Name(ID), ..." text
    status: str = 'Proposed'   # mapped app status (drives dashboards)
    stage: str = ''            # raw "Stage of the Idea" from the sheet
    workflow: str = ''         # "Idea Workflow"
    source: str = ''           # "Idea source"
    project_name: str = ''     # "ESA Project Name"
    solution: str = Field(default='', sa_column=Column(Text))
    benefit: str = Field(default='', sa_column=Column(Text))
    competency: str = ''       # "Idea Competency"
    tags: str = ''             # "Tags"
    created_on: str = ''       # "Idea Created On" (stored as text)
    rating: float = 0          # "Overall Idea Rating"
    savings_type: str = ''     # '' | 'Soft Dollar' | 'Hard Dollar'
    savings_amount: float = 0  # estimated dollar savings for this idea
    sprint: str = ''           # sprint/month this idea is mapped to
    comments: str = Field(default='', sa_column=Column(Text))  # free-text idea details / notes
    custom_json: str = Field(default='{}', sa_column=Column(Text))


class Sprint(SQLModel, table=True):
    """A per-member, per-sprint story-point record. Unique on (member, sprint)."""
    id: Optional[int] = Field(default=None, primary_key=True)
    member_id: str = ''
    sprint: str = ''
    committed: float = 0
    completed: float = 0
    target_ideas: float = 0
    comments: str = ''


class TrainingCourse(SQLModel, table=True):
    """A training course. id is the course code (e.g. ELRNG01555)."""
    id: str = Field(primary_key=True)
    name: str = ''


class TrainingStatus(SQLModel, table=True):
    """A member's status for a given course. Unique on (member, course)."""
    id: Optional[int] = Field(default=None, primary_key=True)
    member_id: str = ''
    course_id: str = ''
    status: str = ''


class TrainingStatusOption(SQLModel, table=True):
    """An admin-configurable status value (and colour) for the training matrix."""
    id: str = Field(primary_key=True)
    label: str = ''
    color: str = '#5e6a82'
    sort: int = 0


class CustomField(SQLModel, table=True):
    """A user-defined field attached to member, idea or workitem records."""
    id: str = Field(primary_key=True)
    entity: str = ''           # 'member' | 'idea' | 'workitem'
    label: str = ''
    type: str = 'text'         # text | number | select | textarea | date
    options_json: str = Field(default='[]', sa_column=Column(Text))
    on_card: bool = False      # (workitem) show this field on the board card face
    sort: int = 0


class Framework(SQLModel, table=True):
    """A scaling / agile framework (Scrum, Kanban, SAFe, ...). Each framework
    owns its own board template (columns + types) and cadence settings."""
    id: str = Field(primary_key=True)
    name: str = ''
    iteration_label: str = 'Sprint'   # Sprint | Iteration | PI
    uses_sprints: bool = True         # Kanban / flow = False (continuous)
    sprint_length_weeks: int = 2
    swimlane: str = ''                # '' | assignee | pod | priority | type
    sort: int = 0


class BoardColumn(SQLModel, table=True):
    """A configurable board column / state, scoped to a framework."""
    id: str = Field(primary_key=True)
    framework_id: str = ''
    name: str = ''
    sort: int = 0
    wip_limit: int = 0         # 0 = no limit
    is_done: bool = False      # items here count as completed
    color: str = '#3b82f6'


class WorkItemType(SQLModel, table=True):
    """A configurable work-item type, scoped to a framework."""
    id: str = Field(primary_key=True)
    framework_id: str = ''
    name: str = ''
    color: str = '#3b82f6'
    sort: int = 0


class PodIteration(SQLModel, table=True):
    """A sprint / iteration period for a specific POD (cadence differs per POD)."""
    id: Optional[int] = Field(default=None, primary_key=True)
    pod: str = ''
    name: str = ''
    sort: int = 0


class BoardSetting(SQLModel, table=True):
    """Misc board configuration as key/value (legacy / global)."""
    key: str = Field(primary_key=True)
    value: str = ''


class WorkItem(SQLModel, table=True):
    """A Scrum-board card. Scoped to a sprint and (optionally) a POD."""
    id: Optional[int] = Field(default=None, primary_key=True)
    title: str = ''
    type_id: str = ''          # WorkItemType.id
    column_id: str = ''        # BoardColumn.id (current state)
    rank: float = 0            # ordering within a column
    assignee: str = ''         # member id
    sprint: str = ''           # iteration
    pod: str = ''              # team
    priority: str = 'Medium'   # Critical | High | Medium | Low
    story_points: float = 0
    tags: str = ''             # comma separated
    description: str = Field(default='', sa_column=Column(Text))
    acceptance: str = Field(default='', sa_column=Column(Text))
    custom_json: str = Field(default='{}', sa_column=Column(Text))
    created_on: str = ''
    updated_on: str = ''


class WorkItemUpdate(SQLModel, table=True):
    """A daily progress note on a work item (standup-style log)."""
    id: Optional[int] = Field(default=None, primary_key=True)
    item_id: int = 0
    date: str = ''             # YYYY-MM-DD
    note: str = Field(default='', sa_column=Column(Text))
    author: str = ''           # member id
    remaining: float = 0       # remaining effort/points (optional)
    created_on: str = ''


class DefectRecord(SQLModel, table=True):
    """A post-production defect tally for one (release, sprint, POD) combination.

    Counts are split by severity; the total and a severity-weighted score are
    derived in the service layer. Unique on (release, sprint, pod).
    """
    id: Optional[int] = Field(default=None, primary_key=True)
    release: str = ''          # release label, e.g. "R2026.1"
    sprint: str = ''           # sprint period name, e.g. "May'26"
    pod: str = ''              # POD code
    critical: int = 0
    high: int = 0
    medium: int = 0
    low: int = 0
    status: str = 'Open'        # Open | In Progress | Fixed | Closed | Implemented
    rca_category: str = ''      # Requirements | Design / Architecture | Coding / Implementation | Testing Gap
    rca_status: str = 'Not Started'  # Not Started | In Progress | Completed | Pending Review
    rca: str = Field(default='', sa_column=Column(Text))   # root-cause notes
    comments: str = Field(default='', sa_column=Column(Text))


class AuditLog(SQLModel, table=True):
    """An append-only record of mutating operations."""
    id: Optional[int] = Field(default=None, primary_key=True)
    ts: str = ''
    action: str = ''           # CREATE | UPDATE | DELETE | UPSERT
    entity: str = ''
    entity_id: str = ''
