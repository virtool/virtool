"""copy hmm status to postgres

Revision ID: ld2t6tbwulbd
Date: 2026-06-05 16:11:15.744084

"""

import arrow
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession
from structlog import get_logger

from virtool.hmm.sql import HMM_STATUS_ID, SQLHMMStatus
from virtool.migration import MigrationContext

logger = get_logger("migration")

# Revision identifiers.
name = "copy hmm status to postgres"
created_at = arrow.get("2026-06-05 16:11:15.744084")
revision_id = "ld2t6tbwulbd"

alembic_down_revision = "d28bebf9934b"
virtool_down_revision = None

# Change this if an Alembic revision is required to run this migration.
required_alembic_revision = "d12be6ff40c1"


async def upgrade(ctx: MigrationContext) -> None:
    """Backfill the Mongo ``status`` singleton into the Postgres ``legacy_hmm_status`` row.

    There is exactly one source document (``_id: "hmm"``) and exactly one target
    row (``id = 1``). The stored Mongo shape is mapped straight across, with two
    exceptions:

    - ``installed`` is polymorphic. ``None`` means nothing is installed; a
      subdocument is the installed release; the legacy boolean ``True`` means the
      latest queued update (``updates[0]``) is installed. ``True`` is normalised
      to ``updates[0]``, failing loudly if ``updates`` is empty since there is
      then no release the boolean could refer to.
    - ``updating`` is derived from ``updates`` at read time and is never stored,
      so it is not written here.

    The insert upserts on the singleton primary key, so the migration tolerates a
    row already written by the live dual-write and is safe to re-run.
    """
    document = await ctx.mongo.status.find_one({"_id": "hmm"})

    if document is None:
        logger.info("no hmm status singleton to migrate")
        return

    installed = document.get("installed")

    if installed is True:
        updates = document.get("updates") or []

        if not updates:
            msg = "HMM status singleton has installed=True but no updates to resolve"
            raise ValueError(msg)

        installed = updates[0]

    task = document.get("task")

    values = {
        "id": HMM_STATUS_ID,
        "errors": document.get("errors") or [],
        "release": document.get("release"),
        "installed": installed,
        "task_id": task["id"] if task else None,
        "updates": document.get("updates") or [],
    }

    async with AsyncSession(ctx.pg) as session:
        await session.execute(
            insert(SQLHMMStatus)
            .values(**values)
            .on_conflict_do_update(
                index_elements=[SQLHMMStatus.id],
                set_={k: v for k, v in values.items() if k != "id"},
            ),
        )
        await session.commit()

    logger.info("hmm status migration complete")
