"""copy hmm annotations to postgres

Revision ID: 6v3b3vunad16
Date: 2026-06-05 21:33:57.513306

"""

import arrow
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession
from structlog import get_logger

from virtool.hmm.sql import SQLHMM
from virtool.migration import MigrationContext

logger = get_logger("migration")

# Revision identifiers.
name = "copy hmm annotations to postgres"
created_at = arrow.get("2026-06-05 21:33:57.513306")
revision_id = "6v3b3vunad16"

alembic_down_revision = "840040ca7266"
virtool_down_revision = None

# Change this if an Alembic revision is required to run this migration.
required_alembic_revision = "d28bebf9934b"


async def upgrade(ctx: MigrationContext) -> None:
    """Backfill every Mongo ``hmm`` document into the Postgres ``hmms`` table.

    One row is written per Mongo document. Documents are processed one at a time
    and committed individually, so memory stays bounded and a failure part-way
    through keeps the rows already written rather than rolling back the whole
    collection.

    The document ``_id`` values are snapshotted up front so the rest of the run
    fetches one document at a time by id, rather than holding a single Mongo
    cursor open for the whole migration.

    Documents already present in Postgres (by ``legacy_id``) are skipped, and the
    insert uses ``ON CONFLICT (legacy_id) DO NOTHING`` as a second line of
    defence, so the migration is safe to re-run after an interruption.

    Every field maps straight across; the Mongo ``_id`` is stored as
    ``legacy_id``. ``hidden`` defaults to ``False`` for documents that predate the
    field, matching the column default and the live dual-write.
    """
    async with AsyncSession(ctx.pg) as session:
        existing_result = await session.execute(
            select(SQLHMM.legacy_id).where(SQLHMM.legacy_id.isnot(None)),
        )
        existing_legacy_ids = {row[0] for row in existing_result}

        logger.info(
            "found existing hmm annotations in postgres",
            count=len(existing_legacy_ids),
        )

        hmm_ids = [
            document["_id"]
            async for document in ctx.mongo.hmm.find({}, projection=["_id"])
        ]

        migrated_count = 0
        skipped_count = 0

        for hmm_id in hmm_ids:
            if hmm_id in existing_legacy_ids:
                skipped_count += 1
                continue

            document = await ctx.mongo.hmm.find_one({"_id": hmm_id})

            if document is None:
                skipped_count += 1
                continue

            await session.execute(
                insert(SQLHMM)
                .values(**_build_values(document))
                .on_conflict_do_nothing(index_elements=["legacy_id"]),
            )
            await session.commit()

            migrated_count += 1

        logger.info(
            "hmm annotation migration complete",
            migrated=migrated_count,
            skipped=skipped_count,
        )


def _build_values(document: dict) -> dict:
    """Map a Mongo ``hmm`` document to a ``SQLHMM`` values dict.

    The integer ``id`` is omitted so the database assigns the identity surrogate
    key. The Mongo ``_id`` becomes ``legacy_id``; every other field maps straight
    across.
    """
    return {
        "legacy_id": document["_id"],
        "cluster": document["cluster"],
        "count": document["count"],
        "length": document["length"],
        "mean_entropy": document["mean_entropy"],
        "total_entropy": document["total_entropy"],
        "hidden": document.get("hidden", False),
        "names": document["names"],
        "families": document["families"],
        "genera": document["genera"],
        "entries": document["entries"],
    }
