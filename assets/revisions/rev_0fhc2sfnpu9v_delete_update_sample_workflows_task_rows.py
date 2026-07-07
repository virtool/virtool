"""delete update_sample_workflows task rows

The ``SampleWorkflowsUpdateTask`` (``update_sample_workflows``) has been removed:
workflow tags are now derived on read instead of recalculated by a periodic task.

The task runner only acquires task types it still supports, so any queued
``update_sample_workflows`` row spawned before this deploy would never be picked
up and would sit ``complete = false`` forever. ``TasksData.get_counts`` counts
every incomplete, non-errored row regardless of type, so a single stale row would
permanently inflate the autoscaling signal. Delete the outstanding rows.

Idempotent: the delete matches nothing once the rows are gone.

Revision ID: 0fhc2sfnpu9v
Date: 2026-07-07 16:02:39.752707

"""

import arrow
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession
from structlog import get_logger

from virtool.migration import MigrationContext
from virtool.tasks.sql import SQLTask

logger = get_logger("migration")

# Revision identifiers.
name = "delete update_sample_workflows task rows"
created_at = arrow.get("2026-07-07 16:02:39.752707")
revision_id = "0fhc2sfnpu9v"

alembic_down_revision = None
virtool_down_revision = "xgqo66avrcdh"

# Change this if an Alembic revision is required to run this migration.
required_alembic_revision = None


async def upgrade(ctx: MigrationContext) -> None:
    """Delete outstanding ``update_sample_workflows`` task rows."""
    async with AsyncSession(ctx.pg) as pg_session:
        result = await pg_session.execute(
            delete(SQLTask).where(
                SQLTask.type == "update_sample_workflows",
                SQLTask.complete.is_(False),
                SQLTask.error.is_(None),
            ),
        )
        await pg_session.commit()

    logger.info(
        "deleted stale update_sample_workflows task rows",
        count=result.rowcount,
    )
