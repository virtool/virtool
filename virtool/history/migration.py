"""Shared backfill logic for copying legacy inline history diffs into Postgres.

Historic ``history`` documents store their OTU diff inline in the Mongo ``diff``
field. Newer writes store the sentinel ``"postgres"`` there and keep the real
diff in the ``history_diffs`` Postgres table. This module copies every remaining
inline diff into ``history_diffs`` and then flips the Mongo document to the
sentinel, so the two stores converge and reads can later be served from Postgres
alone.
"""

from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession
from structlog import get_logger

from virtool.history.sql import SQLHistoryDiff
from virtool.migration import MigrationContext

logger = get_logger("migration")

POSTGRES_SENTINEL = "postgres"


async def backfill_inline_history_diffs(ctx: MigrationContext) -> None:
    """Copy every legacy inline ``history`` diff into the ``history_diffs`` table.

    Each Mongo ``history`` document whose ``diff`` field still holds an inline diff
    is copied into Postgres keyed by ``change_id`` (the Mongo ``_id``), then flipped
    to the ``"postgres"`` sentinel. The insert uses
    ``ON CONFLICT (change_id) DO NOTHING``, so a re-run never duplicates a row and
    the backfill is safe to repeat after an interruption.

    The Postgres write is committed before the Mongo flip, so an interrupted run can
    only ever leave a document still carrying its inline diff -- never a document
    flipped to ``"postgres"`` without a backing ``history_diffs`` row. Because a
    change is immutable, the ``DO NOTHING`` branch (row already written by the live
    dual-write) is consistent with the inline value, so flipping afterwards is safe.

    Change ids are snapshotted up front with a projection-only query, then each
    document is fetched individually, so the run never holds a single cursor open for
    the whole collection.

    Documents whose ``diff`` is neither the sentinel nor a JSON structure (a list for
    edits, a dict for creates and removes) cannot be recovered inline -- for example
    a filesystem sentinel, which is out of scope here -- so they are logged and
    skipped rather than failing the migration.
    """
    async with AsyncSession(ctx.pg) as session:
        change_ids = [
            document["_id"]
            async for document in ctx.mongo.history.find(
                {"diff": {"$ne": POSTGRES_SENTINEL}},
                projection=["_id"],
            )
        ]

        logger.info("found inline history diffs to backfill", count=len(change_ids))

        migrated_count = 0
        skipped_count = 0

        for change_id in change_ids:
            document = await ctx.mongo.history.find_one({"_id": change_id})

            if document is None:
                skipped_count += 1
                continue

            diff = document["diff"]

            if diff == POSTGRES_SENTINEL:
                skipped_count += 1
                continue

            if not isinstance(diff, (list, dict)):
                logger.warning(
                    "history document has an unrecoverable inline diff; skipping",
                    change_id=change_id,
                    diff=diff,
                )
                skipped_count += 1
                continue

            await session.execute(
                insert(SQLHistoryDiff)
                .values(change_id=change_id, diff=diff)
                .on_conflict_do_nothing(index_elements=["change_id"]),
            )
            await session.commit()

            await ctx.mongo.history.update_one(
                {"_id": change_id},
                {"$set": {"diff": POSTGRES_SENTINEL}},
            )

            migrated_count += 1

        logger.info(
            "inline history diff backfill complete",
            migrated=migrated_count,
            skipped=skipped_count,
        )
