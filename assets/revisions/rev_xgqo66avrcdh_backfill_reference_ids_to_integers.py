"""backfill reference ids to integers

Populate ``analyses.reference_id`` and ``legacy_history.reference_id`` from the
legacy Mongo ``reference`` string now that references live in Postgres as
``legacy_references`` with an integer ``id`` and a permanent ``legacy_id``.

Each update is set-based and idempotent: it only touches rows whose
``reference_id`` is still ``NULL``, resolving the legacy ``reference`` string to
``legacy_references.id`` via ``legacy_references.legacy_id``. Re-running fills
only rows created since the last run.

A row whose ``reference`` string resolves to no ``legacy_references`` row raises
loudly rather than being left ``NULL`` -- a reference is a required relationship
for both analyses and history, so an unresolved reference is a data-integrity
problem that must surface.

Revision ID: xgqo66avrcdh
Date: 2026-07-06 23:05:46.057817

"""

import arrow
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from structlog import get_logger

from virtool.migration import MigrationContext

logger = get_logger("migration")

# Revision identifiers.
name = "backfill reference ids to integers"
created_at = arrow.get("2026-07-06 23:05:46.057817")
revision_id = "xgqo66avrcdh"

alembic_down_revision = "91b32f49a8b2"
virtool_down_revision = None

# Change this if an Alembic revision is required to run this migration.
required_alembic_revision = None


async def upgrade(ctx: MigrationContext) -> None:
    async with AsyncSession(ctx.pg) as pg_session:
        analyses_result = await pg_session.execute(
            text(
                "UPDATE analyses a "
                "SET reference_id = r.id "
                "FROM legacy_references r "
                "WHERE a.reference = r.legacy_id AND a.reference_id IS NULL",
            ),
        )

        history_result = await pg_session.execute(
            text(
                "UPDATE legacy_history h "
                "SET reference_id = r.id "
                "FROM legacy_references r "
                "WHERE h.reference = r.legacy_id AND h.reference_id IS NULL",
            ),
        )

        for table in ("analyses", "legacy_history"):
            unresolved = (
                (
                    await pg_session.execute(
                        text(
                            f"SELECT reference FROM {table} "  # noqa: S608
                            "WHERE reference_id IS NULL",
                        ),
                    )
                )
                .scalars()
                .all()
            )

            if unresolved:
                msg = (
                    f"{table} references {len(unresolved)} reference(s) not found "
                    f"in postgres: {sorted(set(unresolved))}"
                )
                raise ValueError(msg)

        await pg_session.commit()

    logger.info(
        "backfilled reference ids",
        analyses_updated=analyses_result.rowcount,
        legacy_history_updated=history_result.rowcount,
    )
