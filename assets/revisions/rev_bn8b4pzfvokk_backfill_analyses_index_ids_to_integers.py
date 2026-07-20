"""backfill analyses index ids to integers

Populate ``analyses.index_id`` from the legacy Mongo ``index`` string now that
indexes live in Postgres with an integer ``id`` and a permanent ``legacy_id``.

The update is set-based and idempotent: it only touches rows whose ``index_id``
is still ``NULL``, resolving ``analyses.index`` to ``indexes.id`` via
``indexes.legacy_id``. A second run matches no rows and is a no-op.

``analyses.index`` is NOT NULL -- every analysis has an index, and always has.
An ``index`` string that resolves to no ``indexes`` row is therefore not an
optional link but a data-integrity problem: either an index was destroyed out
from under an analysis, or the parity gate passed on a Postgres store missing
rows. Both must surface as a failed deploy, so an unresolved reference raises
loudly rather than being left ``NULL`` for a later join to silently drop.

Revision ID: bn8b4pzfvokk
Date: 2026-07-17 23:38:08.489553

"""

import arrow
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from structlog import get_logger

from virtool.migration import MigrationContext

logger = get_logger("migration")

# Revision identifiers.
name = "backfill analyses index ids to integers"
created_at = arrow.get("2026-07-17 23:38:08.489553")
revision_id = "bn8b4pzfvokk"

alembic_down_revision = "1f020bfe6b18"
virtool_down_revision = None

# Change this if an Alembic revision is required to run this migration.
required_alembic_revision = None


async def upgrade(ctx: MigrationContext) -> None:
    async with AsyncSession(ctx.pg) as pg_session:
        result = await pg_session.execute(
            text(
                "UPDATE analyses a "
                "SET index_id = i.id "
                "FROM indexes i "
                "WHERE a.index = i.legacy_id AND a.index_id IS NULL",
            ),
        )

        unresolved = (
            (
                await pg_session.execute(
                    text("SELECT a.index FROM analyses a WHERE a.index_id IS NULL"),
                )
            )
            .scalars()
            .all()
        )

        if unresolved:
            msg = (
                f"Analyses reference {len(unresolved)} index(es) not found in "
                f"postgres: {sorted(set(unresolved))}"
            )
            raise ValueError(msg)

        await pg_session.commit()

    logger.info("backfilled analyses index ids", updated=result.rowcount)
