"""purge iimi analyses

Permanently delete every ``workflow = "iimi"`` analysis and its on-disk result
files. The ``iimi`` workflow has been removed from Virtool; these analyses are
already hidden from the API and are now purged outright.

Analyses are mid-migration from Mongo to Postgres, so an iimi analysis may exist
in the Postgres ``analyses`` table, the Mongo ``analyses`` collection, or both.
Storage prefixes are gathered from both stores before any rows are deleted, then
the files are removed, then the rows are deleted from each store. Doing the file
deletion before the row deletion means an interrupted run still has the rows
needed to recompute the prefixes on a re-run.

Idempotent: a re-run finds no iimi rows, recomputes no prefixes, and deletes
nothing. ``delete_prefix`` is a no-op against already-removed keys.

Revision ID: icp41e0o5dwn
Date: 2026-06-30 19:38:26.167797

"""

import arrow
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from structlog import get_logger

from virtool.analyses.sql import SQLAnalysis
from virtool.migration import MigrationContext
from virtool.storage.cleanup import delete_prefix

logger = get_logger("migration")

# Revision identifiers.
name = "purge iimi analyses"
created_at = arrow.get("2026-06-30 19:38:26.167797")
revision_id = "icp41e0o5dwn"

alembic_down_revision = "ed265b939a84"
virtool_down_revision = None

# Change this if an Alembic revision is required to run this migration.
required_alembic_revision = None

IIMI_WORKFLOW = "iimi"


async def upgrade(ctx: MigrationContext) -> None:
    """Purge every iimi analysis and its on-disk files from both stores."""
    prefixes = await _collect_storage_prefixes(ctx)

    logger.info("found iimi analysis files to purge", count=len(prefixes))

    for prefix in prefixes:
        for key, exc in await delete_prefix(ctx.storage, prefix):
            logger.error(
                "storage cleanup failed; file orphaned",
                prefix=prefix,
                key=key,
                error=repr(exc),
            )

    async with AsyncSession(ctx.pg) as session:
        result = await session.execute(
            delete(SQLAnalysis).where(SQLAnalysis.workflow == IIMI_WORKFLOW),
        )
        await session.commit()

        postgres_deleted = result.rowcount

    mongo_result = await ctx.mongo.analyses.delete_many({"workflow": IIMI_WORKFLOW})

    logger.info(
        "purged iimi analyses",
        postgres=postgres_deleted,
        mongo=mongo_result.deleted_count,
    )


async def _collect_storage_prefixes(ctx: MigrationContext) -> set[str]:
    """Collect the storage prefix of every iimi analysis across both stores.

    Files live under ``samples/{sample}/analysis/{legacy_id}/``, where
    ``legacy_id`` is the analysis' Mongo ``_id``. Postgres and Mongo are
    snapshotted up front so the slow per-prefix storage deletes don't hold a
    Mongo cursor open. The same analysis copied into both stores yields the same
    prefix, so collecting into a set deduplicates it.
    """
    prefixes: set[str] = set()

    async with AsyncSession(ctx.pg) as session:
        rows = await session.execute(
            select(SQLAnalysis.sample, SQLAnalysis.legacy_id).where(
                SQLAnalysis.workflow == IIMI_WORKFLOW,
            ),
        )

        for sample, legacy_id in rows:
            if legacy_id is None:
                logger.warning(
                    "iimi analysis has no legacy id; cannot locate its files",
                    sample=sample,
                )
                continue

            prefixes.add(f"samples/{sample}/analysis/{legacy_id}/")

    async for document in ctx.mongo.analyses.find(
        {"workflow": IIMI_WORKFLOW},
        projection=["sample"],
    ):
        prefixes.add(
            f"samples/{document['sample']['id']}/analysis/{document['_id']}/",
        )

    return prefixes
