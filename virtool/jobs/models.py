from datetime import datetime
from enum import Enum
from typing import Any

from virtool.models import BaseModel, SearchResult
from virtool.users.models_base import UserNested


class JobPing(BaseModel):
    """A model for the ping status a job."""

    cancelled: bool
    """Whether the job has been cancelled."""

    pinged_at: datetime
    """The time the job was last pinged."""


class JobState(Enum):
    """Canonical job states stored in PostgreSQL."""

    CANCELLED = "cancelled"
    FAILED = "failed"
    PENDING = "pending"
    RUNNING = "running"
    SUCCEEDED = "succeeded"


class Workflow(Enum):
    BUILD_INDEX = "build_index"
    CREATE_SAMPLE = "create_sample"
    CREATE_SUBTRACTION = "create_subtraction"
    NUVS = "nuvs"
    PATHOSCOPE = "pathoscope"


class WorkflowCounts(BaseModel):
    """Counts per workflow."""

    build_index: int = 0
    create_sample: int = 0
    create_subtraction: int = 0
    nuvs: int = 0
    pathoscope: int = 0


class JobCounts(BaseModel):
    """Job counts grouped by state and workflow."""

    cancelled: WorkflowCounts = WorkflowCounts()
    failed: WorkflowCounts = WorkflowCounts()
    pending: WorkflowCounts = WorkflowCounts()
    running: WorkflowCounts = WorkflowCounts()
    succeeded: WorkflowCounts = WorkflowCounts()


TERMINAL_JOB_STATES = (
    JobState.CANCELLED,
    JobState.FAILED,
    JobState.SUCCEEDED,
)


class JobStepDefinition(BaseModel):
    """A workflow step definition."""

    id: str
    name: str
    description: str


class JobStepStarted(BaseModel):
    """Response model for step status updates."""

    id: str
    name: str
    description: str
    started_at: datetime


class CreateJobClaimRequest(BaseModel):
    """Request body for claiming a job."""

    runner_id: str
    mem: float
    cpu: float
    image: str
    runtime_version: str
    workflow_version: str
    steps: list[JobStepDefinition]


class JobClaim(BaseModel):
    """Claim metadata for a job."""

    runner_id: str
    mem: float
    cpu: float
    image: str
    runtime_version: str
    workflow_version: str


class JobStep(BaseModel):
    """A workflow step."""

    id: str
    name: str
    description: str
    started_at: datetime | None


class JobMinimal(BaseModel):
    """A minimal representation of a job for list responses."""

    id: int
    created_at: datetime
    progress: int
    state: JobState
    user: UserNested
    workflow: Workflow


class JobSearchResult(SearchResult):
    counts: JobCounts
    items: list[JobMinimal]


class Job(BaseModel):
    """A complete representation of a job."""

    id: int
    args: dict[str, Any]
    claim: JobClaim | None
    claimed_at: datetime | None
    created_at: datetime
    pinged_at: datetime | None
    progress: int
    state: JobState
    steps: list[JobStep] | None
    user: UserNested
    workflow: Workflow


class JobWithKey(Job):
    """A job representation that includes the one-time runner secret key."""

    key: str


class JobClaimed(BaseModel):
    """A job that has been claimed by a runner.

    Includes the secret key that is only returned once at claim time.
    """

    id: int
    acquired: bool
    claim: JobClaim
    claimed_at: datetime
    created_at: datetime
    key: str
    state: JobState
    steps: list[JobStep]
    user: UserNested
    workflow: Workflow
