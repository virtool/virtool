"""Copy jobs to postgres.

Revision ID: xtwxolun286s
Date: 2026-01-07 18:03:11.554276
"""

import arrow
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from structlog import get_logger

from virtool.jobs.models import TERMINAL_JOB_STATES, V1_TO_V2_STATE, JobState
from virtool.jobs.pg import (
    SQLJob,
    SQLJobAnalysis,
    SQLJobIndex,
    SQLJobSample,
    SQLJobSubtraction,
)
from virtool.migration import MigrationContext
from virtool.users.pg import SQLUser
from virtool.utils import get_safely

logger = get_logger("migration")

# Revision identifiers.
name = "copy jobs to postgres"
created_at = arrow.get("2026-01-07 18:03:11.554276")
revision_id = "xtwxolun286s"

alembic_down_revision = "fd093be5e5c3"
virtool_down_revision = None

# Change this if an Alembic revision is required to run this migration.
required_alembic_revision = None


async def upgrade(ctx: MigrationContext) -> None:
    """Copy all jobs from MongoDB to PostgreSQL.

    Skips jobs that already exist in PostgreSQL (by legacy_id).
    """
    async with AsyncSession(ctx.pg) as pg_session:
        # Get all existing legacy_ids to skip.
        result = await pg_session.execute(
            select(SQLJob.legacy_id).where(SQLJob.legacy_id.isnot(None)),
        )
        existing_legacy_ids = {row[0] for row in result}

        logger.info(
            "found existing jobs in postgres",
            count=len(existing_legacy_ids),
        )

        # Build a map of legacy user IDs to PostgreSQL user IDs.
        user_result = await pg_session.execute(
            select(SQLUser.id, SQLUser.legacy_id).where(SQLUser.legacy_id.isnot(None)),
        )
        user_id_map = {row.legacy_id: row.id for row in user_result}

        logger.info("built user ID map", count=len(user_id_map))

        migrated_count = 0
        skipped_count = 0

        async for job in ctx.mongo.jobs.find():
            job_id = job["_id"]

            # Skip if already migrated.
            if job_id in existing_legacy_ids:
                skipped_count += 1
                continue

            await _migrate_job(pg_session, job, user_id_map)
            migrated_count += 1

        await pg_session.commit()

        logger.info(
            "job migration complete",
            migrated=migrated_count,
            skipped=skipped_count,
        )


async def _migrate_job(
    pg_session: AsyncSession,
    job: dict,
    user_id_map: dict[str, int],
) -> None:
    """Migrate a single job from MongoDB to PostgreSQL."""
    job_id = job["_id"]

    user_id = get_safely(job, "user", "id")

    if user_id is None:
        msg = f"Job {job_id} has no user"
        raise ValueError(msg)

    # Handle both modern integer IDs and legacy string IDs.
    if isinstance(user_id, int):
        pg_user_id = user_id
    else:
        pg_user_id = user_id_map.get(user_id)

        if pg_user_id is None:
            msg = f"User {user_id} not found in postgres for job {job_id}"
            raise ValueError(msg)

    # Get state from last status entry.
    status_list = job.get("status", [])

    if not status_list:
        msg = f"Job {job_id} has no status"
        raise ValueError(msg)

    last_status = status_list[-1]
    v1_state = JobState(last_status.get("state", "waiting"))
    v2_state = V1_TO_V2_STATE[v1_state].value

    # Determine finished_at (only for terminal states).
    finished_at = None
    if v1_state in TERMINAL_JOB_STATES:
        finished_at = last_status.get("timestamp")

    # Get created_at from job or first status.
    created_at = job.get("created_at") or status_list[0].get("timestamp")

    if created_at is None:
        msg = f"Job {job_id} has no created_at"
        raise ValueError(msg)

    # Get ping timestamp.
    ping_data = job.get("ping")
    pinged_at = ping_data.get("pinged_at") if ping_data else None

    # Create the SQLJob.
    sql_job = SQLJob(
        acquired=job.get("acquired", False),
        created_at=created_at,
        finished_at=finished_at,
        key=job.get("key"),
        legacy_id=job_id,
        pinged_at=pinged_at,
        state=v2_state,
        user_id=pg_user_id,
        workflow=job.get("workflow"),
    )

    pg_session.add(sql_job)
    await pg_session.flush()

    _add_job_relationship(pg_session, sql_job.id, job)


def _add_job_relationship(pg_session: AsyncSession, job_id: int, job: dict) -> None:
    """Add the appropriate relationship record based on workflow."""
    workflow = job.get("workflow")
    args = job.get("args", {})

    if workflow == "create_sample" and "sample_id" in args:
        pg_session.add(SQLJobSample(job_id=job_id, sample_id=args["sample_id"]))
    elif workflow == "build_index" and "index_id" in args:
        pg_session.add(SQLJobIndex(job_id=job_id, index_id=args["index_id"]))
    elif workflow == "create_subtraction" and "subtraction_id" in args:
        pg_session.add(
            SQLJobSubtraction(job_id=job_id, subtraction_id=args["subtraction_id"]),
        )
    elif workflow in ("aodp", "nuvs", "pathoscope") and "analysis_id" in args:
        pg_session.add(SQLJobAnalysis(job_id=job_id, analysis_id=args["analysis_id"]))
