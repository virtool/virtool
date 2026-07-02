"""Shared backfill logic for copying legacy inline history diffs into Postgres.

Historic ``history`` documents store their OTU diff inline in the Mongo ``diff``
field. Newer writes store the sentinel ``"postgres"`` there and keep the real
diff in the ``history_diffs`` Postgres table. This module copies every remaining
inline diff into ``history_diffs`` and then flips the Mongo document to the
sentinel, so the two stores converge and reads can later be served from Postgres
alone.
"""

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession
from structlog import get_logger

from virtool.history.db import legacy_history_values
from virtool.history.sql import SQLHistoryDiff, SQLLegacyHistory
from virtool.migration import MigrationContext
from virtool.users.pg import SQLUser

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


async def copy_history_to_postgres(ctx: MigrationContext) -> None:
    """Backfill every Mongo ``history`` document into the ``legacy_history`` table.

    One row is written per Mongo document, so the Postgres row count matches the
    Mongo document count exactly. The field mapping -- including the sentinel-to-NULL
    conventions for ``otu.version``, ``index.id``, and ``index.version`` -- is shared
    with the live dual-write through :func:`legacy_history_values`, so the two paths
    can never drift.

    The document ``_id`` values are snapshotted up front with a projection-only query,
    then each document is fetched individually inside the loop, so the run never holds
    a single cursor open for the whole collection.

    Documents already present in Postgres (by ``legacy_id``) are skipped, and the
    insert uses ``ON CONFLICT (legacy_id) DO NOTHING`` as a second line of defence, so
    the backfill is safe to re-run after an interruption. Each document is committed
    individually to bound memory and keep the rows already written on a failure
    part-way through.

    A history change always has an author, so ``user`` is required: the document's
    ``user.id`` is resolved to a Postgres ``users.id`` and the migration raises if it
    cannot be resolved rather than storing ``NULL``. Modern integer ids are used
    directly (the foreign key enforces their existence); legacy string ids are
    resolved through a cached ``legacy_id`` map.
    """
    async with AsyncSession(ctx.pg) as session:
        existing_result = await session.execute(
            select(SQLLegacyHistory.legacy_id).where(
                SQLLegacyHistory.legacy_id.isnot(None),
            ),
        )
        existing_legacy_ids = {row[0] for row in existing_result}

        logger.info(
            "found existing legacy history in postgres",
            count=len(existing_legacy_ids),
        )

        user_result = await session.execute(
            select(SQLUser.id, SQLUser.legacy_id).where(SQLUser.legacy_id.isnot(None)),
        )
        user_id_map = {row.legacy_id: row.id for row in user_result}

        logger.info("built user ID map", count=len(user_id_map))

        change_ids = [
            document["_id"]
            async for document in ctx.mongo.history.find({}, projection=["_id"])
        ]

        migrated_count = 0
        skipped_count = 0

        for change_id in change_ids:
            if change_id in existing_legacy_ids:
                skipped_count += 1
                continue

            document = await ctx.mongo.history.find_one({"_id": change_id})

            if document is None:
                skipped_count += 1
                continue

            user_id = _resolve_user_id(document, user_id_map)

            values = legacy_history_values(document)
            values["user_id"] = user_id

            await session.execute(
                insert(SQLLegacyHistory)
                .values(**values)
                .on_conflict_do_nothing(index_elements=["legacy_id"]),
            )
            await session.commit()

            migrated_count += 1

        logger.info(
            "legacy history backfill complete",
            migrated=migrated_count,
            skipped=skipped_count,
        )


def _resolve_user_id(document: dict, user_id_map: dict[str, int]) -> int:
    """Resolve a history document's ``user.id`` to a Postgres ``users.id``.

    A modern integer id is used directly; a legacy string id is looked up in
    ``user_id_map``. Raises if the document has no user or the reference cannot be
    resolved -- ``legacy_history.user_id`` is required and must never be ``NULL``.
    """
    change_id = document["_id"]

    user = document.get("user")

    if user is None or user.get("id") is None:
        msg = f"History document {change_id} has no user"
        raise ValueError(msg)

    reference = user["id"]

    if isinstance(reference, int):
        return reference

    pg_user_id = user_id_map.get(reference)

    if pg_user_id is None:
        msg = f"User {reference} not found in postgres for history document {change_id}"
        raise ValueError(msg)

    return pg_user_id
