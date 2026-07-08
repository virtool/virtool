"""backfill analyses sample ids to integers

Populate ``analyses.sample_id`` from the legacy Mongo ``sample`` string now that
samples live in Postgres as ``legacy_samples`` with an integer ``id`` and a
permanent ``legacy_id``.

The update is set-based and idempotent: it only touches rows whose ``sample_id``
is still ``NULL``, resolving ``analyses.sample`` to ``legacy_samples.id`` via
``legacy_samples.legacy_id``. Re-running fills only rows created since the last
run.

An analysis whose ``sample`` string resolves to no ``legacy_samples`` row raises
loudly rather than being left ``NULL`` -- deleting a sample also deletes its
analyses, so an unresolved reference is a data-integrity problem that must
surface.

Revision ID: b4qhmbisvbn3
Date: 2026-07-06 18:48:50.744545

"""

import arrow
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from structlog import get_logger

from virtool.migration import MigrationContext

logger = get_logger("migration")

# Revision identifiers.
name = "backfill analyses sample ids to integers"
created_at = arrow.get("2026-07-06 18:48:50.744545")
revision_id = "b4qhmbisvbn3"

alembic_down_revision = "1f4e528c2149"
virtool_down_revision = None

# Change this if an Alembic revision is required to run this migration.
required_alembic_revision = None


async def upgrade(ctx: MigrationContext) -> None:
    async with AsyncSession(ctx.pg) as pg_session:
        result = await pg_session.execute(
            text(
                "UPDATE analyses a "
                "SET sample_id = s.id "
                "FROM legacy_samples s "
                "WHERE a.sample = s.legacy_id AND a.sample_id IS NULL",
            ),
        )

        unresolved = (
            (
                await pg_session.execute(
                    text("SELECT sample FROM analyses WHERE sample_id IS NULL"),
                )
            )
            .scalars()
            .all()
        )

        if unresolved:
            msg = (
                f"Analyses reference {len(unresolved)} sample(s) not found in "
                f"postgres: {sorted(set(unresolved))}"
            )
            raise ValueError(msg)

        await pg_session.commit()

    logger.info("backfilled analyses sample ids", updated=result.rowcount)
