"""complete update_sample_workflows task rows

The ``SampleWorkflowsUpdateTask`` (``update_sample_workflows``) has been removed:
workflow tags are now derived on read instead of recalculated by a periodic task.

The task runner only acquires task types it still supports, so any queued
``update_sample_workflows`` row spawned before this deploy would never be picked
up and would sit ``complete = false`` forever. ``TasksData.get_counts`` counts
every incomplete, non-errored row regardless of type, so a single stale row would
permanently inflate the autoscaling signal.

These rows are marked complete rather than deleted. During a rolling deploy an old
replica may still be running ``PeriodicTaskSpawner``, and ``create_periodic``
suppresses a new spawn only when a row of the same type exists with
``created_at`` newer than the interval — it does not look at ``complete``. Deleting
the recent row would remove that suppressor and let the old spawner insert a fresh
unacquirable row; completing it keeps the recency marker in place while dropping it
from the active-task count.

Idempotent: the update matches nothing once the rows are complete.

Revision ID: 0fhc2sfnpu9v
Date: 2026-07-07 16:02:39.752707

"""

import arrow
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession
from structlog import get_logger

from virtool.migration import MigrationContext
from virtool.tasks.sql import SQLTask

logger = get_logger("migration")

# Revision identifiers.
name = "complete update_sample_workflows task rows"
created_at = arrow.get("2026-07-07 16:02:39.752707")
revision_id = "0fhc2sfnpu9v"

alembic_down_revision = None
virtool_down_revision = "xgqo66avrcdh"

# Change this if an Alembic revision is required to run this migration.
required_alembic_revision = None


async def upgrade(ctx: MigrationContext) -> None:
    """Mark outstanding ``update_sample_workflows`` task rows complete."""
    async with AsyncSession(ctx.pg) as pg_session:
        result = await pg_session.execute(
            update(SQLTask)
            .where(
                SQLTask.type == "update_sample_workflows",
                SQLTask.complete.is_(False),
                SQLTask.error.is_(None),
            )
            .values(complete=True, progress=100),
        )
        await pg_session.commit()

    logger.info(
        "completed stale update_sample_workflows task rows",
        count=result.rowcount,
    )
