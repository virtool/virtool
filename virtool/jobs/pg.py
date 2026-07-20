"""SQLAlchemy models for jobs.

The legacy MongoDB job document included an ``args`` field containing workflow
arguments like ``sample_name``, ``index_version``, and ``ref_id``. These are not being
migrated to the new SQL schema. Workflows should look up these values from the related
resources.
"""

from datetime import datetime

from sqlalchemy import CheckConstraint, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from virtool.pg.base import Base


class SQLJob(Base):
    __tablename__ = "jobs"

    __table_args__ = (
        CheckConstraint(
            "state IN ('pending', 'running', 'cancelled', 'failed', 'succeeded')",
            name="ck_jobs_state",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    """The unique identifier for the job."""

    acquired: Mapped[bool] = mapped_column(default=False)
    """Whether the job has been acquired by a runner."""

    claim: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    """Information about the runner that claimed this job."""

    claimed_at: Mapped[datetime | None] = mapped_column(nullable=True)
    """When the job was claimed by a runner."""

    created_at: Mapped[datetime]
    """When the job was created."""

    finished_at: Mapped[datetime | None] = mapped_column(nullable=True)
    """When the job finished."""

    key: Mapped[str | None] = mapped_column(nullable=True)
    """The secret key returned to the runner when the job is claimed."""

    legacy_id: Mapped[str | None] = mapped_column(nullable=True, unique=True)
    """The MongoDB _id for this job."""

    pinged_at: Mapped[datetime | None] = mapped_column(nullable=True)
    """When the runner last pinged to indicate the job is still running."""

    state: Mapped[str] = mapped_column(String)
    """The current state of the job."""

    steps: Mapped[list[dict] | None] = mapped_column(JSONB, nullable=True)
    """The workflow steps. Set when the job is claimed."""

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    """The user who created this job."""

    workflow: Mapped[str]
    """The workflow this job is running."""


class SQLJobAnalysis(Base):
    """Links a job to the analysis it created.

    No longer written: analyses now reference their job directly via
    ``SQLAnalysis.job_id``. The model and ``job_analyses`` table are retained
    pending their drop in VIR-2394.
    """

    __tablename__ = "job_analyses"

    job_id: Mapped[int] = mapped_column(ForeignKey("jobs.id"), primary_key=True)
    """The job that is running the analysis."""

    analysis_id: Mapped[str]
    """The analysis being created."""


class SQLJobIndex(Base):
    """Links a job to the index it built.

    No longer written: the index references its job directly via
    ``indexes.job_id``, and ``JobsData.get`` resolves the index through that
    reverse foreign key. The model and ``job_indexes`` table are retained pending
    their drop in VIR-2394.
    """

    __tablename__ = "job_indexes"

    job_id: Mapped[int] = mapped_column(ForeignKey("jobs.id"), primary_key=True)
    """The job that is building the index."""

    index_id: Mapped[str]
    """The index being built."""
