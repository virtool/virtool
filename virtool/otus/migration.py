"""Shared migration logic for the Mongo-to-Postgres OTU and sequence move.

This module holds the idempotent copy used by the OTU/sequence backfill revision,
the authoritative reconciliation that repairs rows the copy left behind, the repair
of OTU documents Mongo itself holds malformed, and the drift check that gates the
read cutover. Keeping them here keeps the logic unit-testable and reusable.

Unlike the standard migration playbook, ``legacy_otus`` and ``legacy_sequences``
have no ``legacy_id`` column: their primary key ``id`` is the Mongo ``_id``
string itself. Idempotency and skip-existing therefore key on ``id`` rather than
``legacy_id``.
"""

import asyncio
from collections import Counter
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, NamedTuple

import arrow
from sqlalchemy import Row, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession
from structlog import get_logger

from virtool.data.topg import resolve_legacy_id
from virtool.migration import MigrationContext
from virtool.otus.db import (
    bulk_upsert_sequence_rows,
    delete_legacy_otu,
    delete_legacy_sequences,
    otu_document_from_row,
    otu_row_values,
    sequence_document_from_row,
    sequence_row_values,
)
from virtool.otus.sql import SQLOTU, SQLSequence
from virtool.references.sql import SQLReference
from virtool.types import Document

logger = get_logger("migration")


async def copy_otus_and_sequences_to_postgres(ctx: MigrationContext) -> None:
    """Backfill every Mongo ``otus`` and ``sequences`` document into Postgres.

    One row is written per Mongo document into ``legacy_otus`` and
    ``legacy_sequences``. The whole document is stored verbatim in the ``data``
    JSONB column and the remaining columns are promoted from it, exactly as the
    dual-write path does. Documents are processed one at a time and committed
    individually, so memory stays bounded and a failure part-way through keeps the
    rows already written rather than rolling back the whole collection.

    The document ``_id`` values are snapshotted up front with a projection-only
    query so the rest of the run fetches one document at a time by id, rather than
    holding a single Mongo cursor open for the entire migration.

    OTUs are backfilled before sequences because ``legacy_sequences.otu_id`` is a
    foreign key to ``legacy_otus.id``. Documents already present in Postgres (by
    ``id``) are skipped, and every insert uses ``ON CONFLICT (id) DO NOTHING`` as a
    second line of defence, so the backfill is safe to re-run after an
    interruption.

    Skipping rows that already exist is what makes this unable to repair a row that
    has drifted from its document. :func:`reconcile_otus_and_sequences` exists for
    that.

    Two integrity failures are loud rather than silent, matching the required
    relationships they represent:

    - An OTU whose embedded ``reference.id`` does not resolve to a
      ``legacy_references`` row raises. Every OTU belongs to a reference, and
      references are already migrated, so an unresolvable one is a data-integrity
      problem, not a nullable relationship.
    - A sequence whose ``otu_id`` matches no ``legacy_otus`` row raises. Such a
      sequence is an orphan that should have been removed upstream by
      :func:`virtool.references.migration.purge_orphaned_references`; the not-null
      foreign key would reject it regardless.
    """
    async with AsyncSession(ctx.pg) as session:
        await _copy_otus(ctx, session)
        await _copy_sequences(ctx, session)


async def _copy_otus(ctx: MigrationContext, session: AsyncSession) -> None:
    """Backfill the Mongo ``otus`` collection into ``legacy_otus``."""
    existing_otu_ids = {row[0] for row in await session.execute(select(SQLOTU.id))}

    logger.info("found existing otus in postgres", count=len(existing_otu_ids))

    otu_ids = [
        document["_id"]
        async for document in ctx.mongo.otus.find({}, projection=["_id"])
    ]

    migrated_count = 0
    skipped_count = 0
    reference_id_cache: dict[int | str, int] = {}

    for otu_id in otu_ids:
        if otu_id in existing_otu_ids:
            skipped_count += 1
            continue

        document = await ctx.mongo.otus.find_one({"_id": otu_id})

        if document is None:
            skipped_count += 1
            continue

        reference_id = await _resolve_reference_id(
            session,
            document,
            reference_id_cache,
        )

        await session.execute(
            insert(SQLOTU)
            .values(**otu_row_values(document, reference_id))
            .on_conflict_do_nothing(index_elements=["id"]),
        )
        await session.commit()

        migrated_count += 1

    logger.info(
        "otu migration complete",
        migrated=migrated_count,
        skipped=skipped_count,
    )


async def _copy_sequences(ctx: MigrationContext, session: AsyncSession) -> None:
    """Backfill the Mongo ``sequences`` collection into ``legacy_sequences``.

    Runs after :func:`_copy_otus` so every parent OTU already has a
    ``legacy_otus`` row. The full set of OTU ids is loaded up front so an orphan
    sequence can be caught with a clear error before the not-null foreign key
    rejects it with an opaque ``IntegrityError``. That set is only a cache: a miss
    is re-checked against Postgres before raising, because the dual-writing
    application may have created the parent OTU after the set was loaded.
    """
    otu_ids_present = {row[0] for row in await session.execute(select(SQLOTU.id))}
    existing_sequence_ids = {
        row[0] for row in await session.execute(select(SQLSequence.id))
    }

    logger.info(
        "found existing sequences in postgres",
        count=len(existing_sequence_ids),
    )

    sequence_ids = [
        document["_id"]
        async for document in ctx.mongo.sequences.find({}, projection=["_id"])
    ]

    migrated_count = 0
    skipped_count = 0

    for sequence_id in sequence_ids:
        if sequence_id in existing_sequence_ids:
            skipped_count += 1
            continue

        document = await ctx.mongo.sequences.find_one({"_id": sequence_id})

        if document is None:
            skipped_count += 1
            continue

        otu_id = document["otu_id"]

        if otu_id not in otu_ids_present:
            if not await _otu_exists(session, otu_id):
                msg = (
                    f"sequence {sequence_id!r} references otu "
                    f"{otu_id!r} which does not exist in postgres"
                )
                raise ValueError(msg)

            otu_ids_present.add(otu_id)

        await session.execute(
            insert(SQLSequence)
            .values(**sequence_row_values(document))
            .on_conflict_do_nothing(index_elements=["id"]),
        )
        await session.commit()

        migrated_count += 1

    logger.info(
        "sequence migration complete",
        migrated=migrated_count,
        skipped=skipped_count,
    )


async def _otu_exists(session: AsyncSession, otu_id: str) -> bool:
    """Check Postgres directly for a ``legacy_otus`` row.

    Used to confirm a sequence's parent really is missing before raising. The OTU
    may have been dual-written by the running application after the up-front id set
    was loaded, in which case the sequence is not an orphan and the backfill must
    not abort.
    """
    return (
        await session.execute(select(SQLOTU.id).where(SQLOTU.id == otu_id))
    ).scalar_one_or_none() is not None


async def _resolve_reference_id(
    session: AsyncSession,
    document: Document,
    cache: dict[int | str, int],
) -> int:
    """Resolve an OTU document's embedded ``reference.id`` to a Postgres id.

    Every OTU belongs to a reference and references are already migrated, so a
    reference that no longer resolves raises rather than being backfilled as
    ``NULL``.
    """
    reference = document["reference"]["id"]

    reference_id = await _lookup_reference_id(session, reference, cache)

    if reference_id is None:
        msg = (
            f"otu {document['_id']!r} references reference {reference!r} "
            "which does not exist in postgres"
        )
        raise ValueError(msg)

    return reference_id


async def _lookup_reference_id(
    session: AsyncSession,
    reference: int | str,
    cache: dict[int | str, int],
) -> int | None:
    """Look up an embedded ``reference.id`` in Postgres, memoising hits.

    The reference may be a legacy string id or a modern integer id;
    :func:`resolve_legacy_id` tolerates both. Hits are memoised because OTUs
    cluster heavily by reference. Misses are not cached: the application keeps
    writing while a migration runs, so a reference that does not resolve now may
    resolve on a later call.
    """
    if reference in cache:
        return cache[reference]

    reference_id = await resolve_legacy_id(session, SQLReference, reference)

    if reference_id is not None:
        cache[reference] = reference_id

    return reference_id


_SETTLE_ATTEMPTS = 3
"""How many times a deferred OTU is re-read before its Mongo write is given up on."""

_SETTLE_DELAY = 0.25
"""Seconds to wait between re-reads of a deferred OTU."""


class _OTUStatus(Enum):
    """What the reconciliation did with one OTU."""

    reconciled = "reconciled"
    """The row was rewritten from its Mongo document."""

    inserted = "inserted"
    """The OTU had no row at all and one was written."""

    missing_from_mongo = "missing from mongo"
    """The document was gone by the time the OTU was reached; the delete pass owns
    it."""

    deleted_mid_run = "deleted mid-run"
    """The row was deleted while this run was in progress; re-creating it would
    resurrect the OTU."""

    postgres_ahead = "postgres ahead"
    """The row reflects a write whose Mongo commit is not visible yet."""


class _OTUOutcome(NamedTuple):
    """The result of reconciling one OTU."""

    status: _OTUStatus
    sequences: int = 0
    deleted_sequences: int = 0


async def reconcile_otus_and_sequences(ctx: MigrationContext) -> None:
    """Rewrite every ``legacy_otus`` and ``legacy_sequences`` row from Mongo.

    An authoritative re-backfill that repairs rows drifted from the documents they
    mirror. :func:`copy_otus_and_sequences_to_postgres` inserts with ``ON CONFLICT
    (id) DO NOTHING`` and so cannot touch a row that already exists, which is
    exactly the row that needs repairing. This upserts instead, overwriting ``data``
    and every promoted column from the current Mongo document.

    That rewrite is what makes the pass general rather than a fix for one defect. It
    repairs, without needing to know which of them applied to a given row:

    - a ``created_at`` stored with microseconds Mongo never held, written by the
      bulk import path before it truncated to the millisecond,
    - a ``last_indexed_version`` that index finalization stamped into Mongo only,
    - a ``position`` never assigned, or assigned before the sequence's OTU had rows,
    - rows for documents Mongo no longer has.

    Unlike the steady-state write path, this pass *does* own ``position``: it reads
    an OTU's sequences with the same unsorted ``find({"otu_id": otu_id})`` that
    :func:`virtool.otus.db.join` uses and counts them off in the order Mongo returns
    them.

    One OTU and its sequences are committed per transaction, bounding memory and
    letting an interrupted run resume. The pass is idempotent: a second run reads the
    same documents in the same order and writes the same values.

    **Postgres is never behind Mongo, and a Mongo read here may be behind Postgres.**

    Every writer commits Postgres first. :func:`virtool.data.topg.both_transactions`
    commits the Postgres session *inside* the still-open Mongo transaction, and the
    bulk reference paths commit their Postgres rows before touching Mongo at all. So a
    writer's rows are visible in Postgres while its Mongo documents are not yet visible
    to anyone. :func:`virtool.otus.db.lock_legacy_otu` cannot close that window -- the
    writer released the row lock at its Postgres commit, before its Mongo write became
    visible -- so this pass must assume its Mongo snapshot may be *older* than the rows
    it is about to rewrite. Every destructive or regressive step is therefore guarded:

    - **Nothing is deleted that a concurrent writer could have created.** The set of
      ``legacy_otus`` ids is snapshotted before the first Mongo read, and only an OTU
      in that snapshot (or one this run inserted itself) may be deleted. An OTU
      dual-written after the run started can never be a delete candidate, so it cannot
      be deleted -- nor, through the ``ON DELETE CASCADE`` on
      ``legacy_sequences.otu_id``, can its sequences.

    - **An OTU whose row vanished mid-run is not re-created.** A Mongo document with no
      Postgres row means the OTU is being deleted right now (the Postgres delete
      committed, the Mongo delete is not visible yet), not that the row is missing:
      Postgres is never behind, so a document that reached Mongo has always reached
      Postgres first. Only an OTU that had no row when the run *started* is inserted,
      which is still enough to fill a hole the backfill left.

    - **A row that is ahead of the Mongo snapshot is not rewritten.** Every path that
      touches an OTU or one of its sequences bumps the OTU's ``version`` in Mongo and
      writes it to ``legacy_otus`` in the same Postgres transaction. So a row whose
      ``version`` is greater than the version this run read from Mongo is proof that the
      snapshot lags a committed Postgres write, and rewriting the OTU from it would
      write a stale document over the newer row and delete the sequence rows that write
      created. Such OTUs are deferred and retried once the run has drained.

    - **``last_indexed_version`` is merged, not overwritten.** Index finalization
      stamps it into both stores without bumping ``version``, so no lag is detectable.
      The stamp only ever raises the value -- it is set to the OTU's current version
      -- so the greater of the row's and the document's is taken, which both repairs a
      stamp that only reached Mongo and preserves one that has only reached Postgres.
    """
    async with AsyncSession(ctx.pg) as session:
        postgres_otu_ids = {row[0] for row in await session.execute(select(SQLOTU.id))}

    otu_ids = [
        document["_id"]
        async for document in ctx.mongo.otus.find({}, projection=["_id"])
    ]

    reference_id_cache: dict[int | str, int] = {}

    counts = dict.fromkeys(_OTUStatus, 0)

    deferred: list[str] = []
    inserted_otu_ids: set[str] = set()

    reconciled_sequences = 0
    deleted_sequences = 0

    async with AsyncSession(ctx.pg) as session:
        for otu_id in otu_ids:
            outcome = await _reconcile_otu(
                ctx,
                session,
                otu_id,
                reference_id_cache,
                existed_in_postgres=otu_id in postgres_otu_ids,
                force=False,
            )

            if outcome.status is _OTUStatus.postgres_ahead:
                deferred.append(otu_id)
                continue

            counts[outcome.status] += 1
            reconciled_sequences += outcome.sequences
            deleted_sequences += outcome.deleted_sequences

            if outcome.status is _OTUStatus.inserted:
                inserted_otu_ids.add(otu_id)

    async with AsyncSession(ctx.pg) as session:
        for otu_id in deferred:
            outcome = await _settle_and_reconcile_otu(
                ctx,
                session,
                otu_id,
                reference_id_cache,
                existed_in_postgres=otu_id in postgres_otu_ids,
            )

            counts[outcome.status] += 1
            reconciled_sequences += outcome.sequences
            deleted_sequences += outcome.deleted_sequences

            if outcome.status is _OTUStatus.inserted:
                inserted_otu_ids.add(otu_id)

    deleted_otus = await _delete_removed_otus(
        ctx,
        postgres_otu_ids | inserted_otu_ids,
    )

    logger.info(
        "otu and sequence reconciliation complete",
        otus=counts[_OTUStatus.reconciled] + counts[_OTUStatus.inserted],
        inserted_otus=counts[_OTUStatus.inserted],
        sequences=reconciled_sequences,
        deleted_otus=deleted_otus,
        deleted_sequences=deleted_sequences,
        deferred_otus=len(deferred),
        missing_from_mongo=counts[_OTUStatus.missing_from_mongo],
        deleted_mid_run=counts[_OTUStatus.deleted_mid_run],
    )


async def _reconcile_otu(
    ctx: MigrationContext,
    session: AsyncSession,
    otu_id: str,
    reference_id_cache: dict[int | str, int],
    *,
    existed_in_postgres: bool,
    force: bool,
) -> _OTUOutcome:
    """Rewrite one OTU's row and its sequences' rows from Mongo.

    The OTU's row is locked with ``SELECT … FOR UPDATE`` -- the same lock every
    dual-write path takes -- *before* Mongo is read, so no writer can commit while the
    OTU is being rewritten. The lock alone does not make the Mongo read current, though,
    because a writer that already committed Postgres released it while its Mongo write
    was still invisible. The row read under the lock is what tells us whether that
    happened; see :func:`reconcile_otus_and_sequences` for the guards it feeds.

    ``force`` rewrites an OTU whose row is ahead of Mongo anyway. See
    :func:`_settle_and_reconcile_otu`.
    """
    row = (
        await session.execute(
            select(SQLOTU.version, SQLOTU.data)
            .where(SQLOTU.id == otu_id)
            .with_for_update(),
        )
    ).one_or_none()

    document = await ctx.mongo.otus.find_one({"_id": otu_id})

    if document is None:
        await session.rollback()
        return _OTUOutcome(_OTUStatus.missing_from_mongo)

    if row is None:
        if existed_in_postgres:
            await session.rollback()
            return _OTUOutcome(_OTUStatus.deleted_mid_run)
    elif not force and row.version > document["version"]:
        await session.rollback()
        return _OTUOutcome(_OTUStatus.postgres_ahead)

    reference_id = await _resolve_reference_id(session, document, reference_id_cache)

    await session.execute(_upsert_otu(document, reference_id, row))

    documents = [
        sequence_document
        async for sequence_document in ctx.mongo.sequences.find({"otu_id": otu_id})
    ]

    await bulk_upsert_sequence_rows(session, documents)

    deleted = await _delete_removed_sequences(
        session,
        otu_id,
        [sequence_document["_id"] for sequence_document in documents],
    )

    await session.commit()

    return _OTUOutcome(
        _OTUStatus.reconciled if row is not None else _OTUStatus.inserted,
        len(documents),
        deleted,
    )


async def _settle_and_reconcile_otu(
    ctx: MigrationContext,
    session: AsyncSession,
    otu_id: str,
    reference_id_cache: dict[int | str, int],
    *,
    existed_in_postgres: bool,
) -> _OTUOutcome:
    """Reconcile an OTU whose row was ahead of Mongo when the main pass reached it.

    The write that put the row ahead commits Mongo immediately after Postgres, so
    re-reading is nearly always enough: by the time the main pass has drained, the
    document carries the write and the OTU reconciles like any other.

    A row that is *still* ahead after the retries is not a lagging write, it is drift --
    a dual-write whose Mongo commit never landed leaves the Postgres row a version ahead
    forever. That is exactly what this revision exists to repair, so Mongo is taken as
    authoritative and the row is rewritten, loudly.
    """
    for _ in range(_SETTLE_ATTEMPTS):
        outcome = await _reconcile_otu(
            ctx,
            session,
            otu_id,
            reference_id_cache,
            existed_in_postgres=existed_in_postgres,
            force=False,
        )

        if outcome.status is not _OTUStatus.postgres_ahead:
            return outcome

        await asyncio.sleep(_SETTLE_DELAY)

    logger.warning(
        "otu row is ahead of mongo and is not catching up; rewriting from mongo",
        otu_id=otu_id,
    )

    return await _reconcile_otu(
        ctx,
        session,
        otu_id,
        reference_id_cache,
        existed_in_postgres=existed_in_postgres,
        force=True,
    )


def _upsert_otu(document: Document, reference_id: int, row: Row | None):
    """Compose an upsert that rewrites a ``legacy_otus`` row from its document.

    The promoted ``last_indexed_version`` column is re-derived from the merged ``data``
    rather than left as the document wrote it, so a stamp the merge preserved is
    written to both and the row cannot come out holding a column that contradicts its
    own JSONB.
    """
    values = otu_row_values(document, reference_id)

    if row is not None:
        values["data"] = _merge_last_indexed_version(values["data"], row.data)
        values["last_indexed_version"] = values["data"]["last_indexed_version"]

    return (
        insert(SQLOTU)
        .values(**values)
        .on_conflict_do_update(
            index_elements=["id"],
            set_={key: value for key, value in values.items() if key != "id"},
        )
    )


def _merge_last_indexed_version(data: Document, row_data: Document) -> Document:
    """Keep a ``last_indexed_version`` the row already holds and Mongo has not caught
    up to.

    Index finalization stamps the field into both stores without bumping the OTU's
    ``version``, so a row stamped just before this run read its document is
    indistinguishable from an unstamped one by any other field. The stamp only ever
    raises the value -- it is set to the OTU's current ``version``, which only ever
    increments -- so the greater of the two is the one that survives, whichever store it
    came from.

    The document is copied rather than rewritten in place; the caller reuses it.
    """
    document_version = data.get("last_indexed_version")
    row_version = row_data.get("last_indexed_version")

    if row_version is None or (
        document_version is not None and document_version >= row_version
    ):
        return data

    return {**data, "last_indexed_version": row_version}


async def _delete_removed_sequences(
    session: AsyncSession,
    otu_id: str,
    sequence_ids: list[str],
) -> int:
    """Delete an OTU's ``legacy_sequences`` rows that Mongo no longer has.

    Safe without re-checking Mongo, but not because of the row lock alone. Every path
    that adds a sequence to an existing OTU -- ``create_sequence`` above all -- bumps
    the OTU's ``version`` and writes it to ``legacy_otus`` in the same Postgres
    transaction, and the caller refuses to reconcile an OTU whose row carries a version
    the Mongo read does not. So a sequence row that this OTU's Mongo read does not
    account for cannot belong to a writer whose Mongo commit is merely not visible yet:
    it is a row for a document that is gone.

    While the caller holds the OTU's row lock no further sequence can be committed
    under it, so that stays true through to the delete.

    The rows to delete are worked out here rather than left to the database as a ``NOT
    IN`` over ``sequence_ids``. That form binds one parameter per sequence the OTU has,
    so a large enough OTU would push the statement past asyncpg's bind parameter cap and
    abort the whole revision, and even well short of it every OTU pays for its entire
    sequence list on a delete that almost always removes nothing. Reading the OTU's row
    ids back costs one bound parameter instead, and only the ids that must go -- those
    Mongo no longer accounts for -- are handed to
    :func:`virtool.otus.db.delete_legacy_sequences`, which chunks them. Usually there
    are none at all and no delete is issued.
    """
    row_ids = {
        row[0]
        for row in await session.execute(
            select(SQLSequence.id).where(SQLSequence.otu_id == otu_id),
        )
    }

    removed = row_ids - set(sequence_ids)

    if not removed:
        return 0

    return await delete_legacy_sequences(session, sorted(removed))


async def _delete_removed_otus(ctx: MigrationContext, deletable: set[str]) -> int:
    """Delete ``legacy_otus`` rows for OTUs Mongo no longer has.

    Deleting an OTU takes its sequences with it through the ``ON DELETE CASCADE`` on
    ``legacy_sequences.otu_id``, so a wrong delete here is the most destructive thing
    this revision can do. Two things keep it from happening.

    Only an OTU in ``deletable`` is considered: one that had a row before the run took
    its first Mongo read, or one this run inserted itself. Every writer commits Postgres
    before Mongo, so an OTU dual-written during the run is in neither set and cannot be
    deleted, however long its Mongo write takes to appear.

    The Mongo ids are re-read here rather than reused from the run's up-front snapshot,
    and each candidate is then re-read individually. An OTU created *and* deleted while
    the run was walking Mongo is the one case where a row this run wrote itself needs
    taking back out again, and only a fresh read can tell.
    """
    mongo_otu_ids = {
        document["_id"]
        async for document in ctx.mongo.otus.find({}, projection=["_id"])
    }

    deleted_count = 0

    async with AsyncSession(ctx.pg) as session:
        for otu_id in sorted(deletable - mongo_otu_ids):
            if await ctx.mongo.otus.find_one({"_id": otu_id}, projection=["_id"]):
                continue

            deleted = await delete_legacy_otu(session, otu_id)
            await session.commit()

            deleted_count += deleted

    return deleted_count


async def repair_string_otu_created_at(ctx: MigrationContext) -> None:
    """Rewrite a Mongo OTU ``created_at`` held as a string as the datetime it means.

    An OTU cloned before December 2022 carries its ``created_at`` as an ISO string
    rather than a BSON date. The clone task took the timestamp from its task context,
    which is a JSONB column, so the datetime the reference was created with came back
    out of Postgres as the string the JSON serializer wrote -- and
    ``insert_joined_otu`` put that string straight into the OTU document. Every OTU of
    such a clone holds one, and they have sat in Mongo ever since.

    Nothing in Mongo minded, because nothing read ``created_at`` as anything but a
    value to serialize back out, and a string serializes to itself. The move to
    Postgres does mind. ``data`` is JSONB and cannot hold a datetime either, so
    :func:`virtool.otus.db.otu_document_from_row` parses ``created_at`` back to the
    datetime an OTU document is supposed to carry -- which is the right thing to do
    for every OTU written since, and which recovers a *datetime* for these, where
    Mongo still holds a string. The two stores then disagree on the type of a field
    they agree on the value of, and :func:`compare_otu_and_sequence_stores` fails the
    read cutover on it.

    The document is the store that is wrong: a Mongo ``created_at`` is a date
    everywhere else in the codebase, and the read path will hand back a datetime for
    these OTUs whether or not the document is repaired. So the string is parsed and
    written back as the datetime it always meant.

    The datetime is floored to the millisecond first, because BSON holds a datetime as
    int64 milliseconds and would drop the microseconds itself. Writing the floored
    value to *both* stores keeps the ``data`` column a faithful lift of the document
    Mongo ends up holding, rather than one microsecond-precise string ahead of it.

    The row is rewritten from the row, not from the document: only ``created_at`` is
    replaced, and every other field of ``data`` is left exactly as the writer that last
    touched it left it. A concurrent dual-write cannot be clobbered by a stale
    snapshot, so no version guard is needed here. The row is locked with
    ``SELECT … FOR UPDATE`` before Mongo is read, as every dual-write path does, so a
    writer that reads the document while the repair holds the lock reads it after the
    repair has landed rather than before.

    Every string is parsed and checked before anything is written, so a store holding
    one this cannot read is left untouched rather than half repaired. See
    :func:`_parse_utc_timestamp` for what it will not read.

    **The string is what makes an OTU findable, so it is the last thing to go.** The
    Mongo write is made inside a transaction that commits *after* the Postgres one, as
    :func:`virtool.data.topg.both_transactions` does. An interrupted run -- or a
    Postgres write that fails -- therefore aborts the Mongo write with it, and the OTU
    is still holding the string that puts it in ``candidates`` next time.

    The alternative loses the OTU. A Mongo write that commits on its own, ahead of the
    Postgres one, is durable the moment it lands: kill the run before the row is
    written, and Mongo holds the floored datetime while ``data`` still holds the
    sub-millisecond string it was floored from. Those disagree, and the OTU no longer
    matches the ``$type: "string"`` query that would have found it, so no re-run
    repairs it and the gate fails on it forever. Nothing recovers what the query cannot
    see.

    Idempotent: a repaired OTU no longer matches ``{"created_at": {"$type": "string"}}``
    and a second run finds nothing to do.
    """
    candidates = {
        document["_id"]: (
            document["created_at"],
            _parse_utc_timestamp(document["_id"], document["created_at"]),
        )
        async for document in ctx.mongo.otus.find(
            {"created_at": {"$type": "string"}},
            projection=["created_at"],
        )
    }

    if not candidates:
        logger.info("no otus hold a string created_at")
        return

    logger.info("repairing otus that hold a string created_at", otus=len(candidates))

    repaired = 0

    for otu_id, (raw, created_at) in candidates.items():
        async with (
            AsyncSession(ctx.pg) as session,
            await ctx.mongo.client.start_session() as mongo_session,
            mongo_session.start_transaction(),
        ):
            row = (
                await session.execute(
                    select(SQLOTU.data).where(SQLOTU.id == otu_id).with_for_update(),
                )
            ).one_or_none()

            document = await ctx.mongo.otus.find_one(
                {"_id": otu_id},
                projection=["created_at"],
                session=mongo_session,
            )

            if document is None or document["created_at"] != raw:
                await session.rollback()
                await mongo_session.abort_transaction()
                continue

            await ctx.mongo.otus.update_one(
                {"_id": otu_id},
                {"$set": {"created_at": created_at}},
                session=mongo_session,
            )

            if row is not None:
                await session.execute(
                    update(SQLOTU)
                    .where(SQLOTU.id == otu_id)
                    .values(data={**row.data, "created_at": created_at}),
                )

            await session.commit()

            repaired += 1

    logger.info("repaired otus that held a string created_at", otus=repaired)


def _parse_utc_timestamp(otu_id: str, created_at: str) -> datetime:
    """Parse an OTU's string ``created_at`` as the naive UTC datetime it denotes.

    Virtool datetimes are naive UTC, and the strings this repairs were written by the
    JSON serializer, which renders one as UTC with a ``Z``. So a string that carries a
    *non-UTC* offset came from somewhere this does not know about, and is refused
    rather than guessed at: ``arrow.get(...).naive`` strips the offset instead of
    applying it, and would file ``01:32:35+02:00`` as ``01:32:35`` UTC -- the same
    wall clock, two hours from the instant it names. Being loud about a handful of
    unreadable documents is worth more than silently shifting them.

    A string with no offset at all is read as UTC, which is what the convention says an
    unqualified Virtool datetime is.

    The result is floored to the millisecond, the precision BSON stores a datetime at.
    """
    parsed = arrow.get(created_at)

    if parsed.utcoffset() != timedelta(0):
        msg = (
            f"otu {otu_id} holds a created_at with a non-utc offset: {created_at!r}. "
            f"it cannot be read as the naive utc datetime the store expects"
        )
        raise ValueError(msg)

    return _floor_to_millisecond(parsed.naive)


def _floor_to_millisecond(created_at: datetime) -> datetime:
    """Drop a datetime's sub-millisecond precision, as a write to Mongo would."""
    return created_at.replace(microsecond=created_at.microsecond // 1000 * 1000)


_OTU_CHUNK_SIZE = 500
"""How many OTUs to hold in memory at once while comparing the two stores."""

_SEQUENCE_CHUNK_SIZE = 200
"""How many sequences to hold in memory at once while comparing the two stores.

Smaller than the OTU chunk because a sequence document carries its nucleotide
string. Both constants exist to bound memory; cutting them costs run time and
nothing else.
"""


_GATE_ATTEMPTS = 2
"""How many times both stores are read before the drift found in them is believed."""

_GATE_SETTLE_DELAY = 0.25
"""Seconds to wait before re-reading stores that reported drift.

Only a floor. The re-read itself walks every OTU and sequence again, and that is most
of the settle on any store large enough for the lag to matter.
"""


async def compare_otu_and_sequence_stores(ctx: MigrationContext) -> None:
    """Verify the Mongo and Postgres OTU and sequence stores agree.

    A gating drift check run after the OTU/sequence reconciliation and before OTU
    and sequence reads switch to Postgres. It changes nothing: it reads every
    production OTU and sequence (no sampling) and raises if the two stores
    disagree.

    The check asserts the *read* contract directly. A row is fed to the very
    functions the read path uses to recover the document it was written from --
    :func:`otu_document_from_row` and :func:`sequence_document_from_row` -- and the
    result must equal the Mongo document. That is the path
    :func:`virtool.otus.db.join` actually takes, so anything it cannot faithfully
    recover is drift by definition, and no separate model of how the ``data`` JSONB
    should look can drift away from the read path over time.

    The promoted columns are checked too, by rebuilding them with the functions the
    dual-write and backfill use -- :func:`otu_row_values` and
    :func:`sequence_row_values`. Everything they normalise is therefore normalised
    identically here and cannot be mistaken for drift:

    - A Mongo ``abbreviation`` of ``None`` or a missing key becomes ``""``.
    - A missing ``segment`` key becomes SQL ``NULL``.
    - An embedded ``reference.id`` in either form -- the legacy string id or the
      integer id written since references were migrated -- resolves to the same
      integer ``legacy_references`` primary key.

    Sequence ordering is checked an OTU at a time, because ``position`` orders a
    sequence *within its OTU* and so is not derivable from a single document. Each
    OTU's rows, sorted by ``position``, must come back in the order Mongo's cursor
    returns them. This matters because a joined OTU rebuilt from Postgres feeds
    :func:`virtool.history.db.patch_to_version`, whose ``dictdiffer`` diffs address
    an isolate's sequences by list index; hand them back reordered and index builds,
    reference clones and analysis formatting all silently apply each stored change
    to the wrong sequence. A ``NULL`` position is drift: Postgres sorts nulls last
    on an ascending order, so an unreconciled row would otherwise be quietly
    shuffled to the end of its OTU instead of failing the check. Two sequences of one
    OTU sharing a position is drift for the same reason: nothing in the schema forbids
    it, and the order of the pair is then whatever plan the database chooses, so an OTU
    whose sequence order is undetermined would otherwise pass whenever the plan of the
    day happened to agree with Mongo. It is the state the position backfill and the
    reconciliation exist to repair, so the gate fails on it rather than sorting around
    it.

    Each check runs in two passes. The first walks both stores and collects
    *candidates*: present in one store but not the other, or holding a row that does
    not match its document. The second re-reads each candidate from both stores
    individually and only reports the ones that still disagree. The application
    keeps writing while a migration runs, so a document written or deleted between
    the two reads would otherwise be reported as drift; the second pass costs
    nothing on a clean run, where there are no candidates.

    Each pass runs in its own :class:`AsyncSession`. The scanning session's identity
    map still holds every row it loaded, and a ``select()`` against it would hand
    those instances back rather than re-reading the row -- which would leave the
    second pass unable to see the very dual-write it exists to tolerate.

    Those two passes tolerate a write whose Mongo commit lands *between* them. They do
    not tolerate one whose Mongo commit has not landed by the time of the second read.
    :func:`virtool.data.topg.both_transactions` commits the Postgres session inside the
    still-open Mongo transaction, so a dual-write makes its row visible here while the
    document it was written from is still invisible -- and both passes then read the
    same stale document and call a converging OTU drifted. Postgres is never behind
    Mongo; a Mongo read may be arbitrarily behind Postgres.

    So drift is not believed the first time it is seen. The whole check is re-run, and
    only drift that survives a second reading of both stores is reported. That gives an
    in-flight write time to land: mostly the re-scan itself, which re-reads every
    document, with :data:`_GATE_SETTLE_DELAY` in front of it for a store small enough
    that the re-scan is quick. Drift that is real is unaffected -- no write is going to
    land and resolve it -- so the gate still fails, and still halts the migration.

    The re-run costs nothing on a clean run, where there is no drift to re-check, and
    is only paid on the path that was about to fail the migration anyway.

    The check is exhaustive before it fails: drift is accumulated across every OTU
    and sequence, the full per-document diff is logged, and a single
    :class:`ValueError` is raised at the end. A clean run logs zero drift with the
    document counts.
    """
    for attempt in range(_GATE_ATTEMPTS):
        otu_drift = await _compare_otus(ctx)
        sequence_drift = await _compare_sequences(ctx)
        order_drift = await _compare_sequence_orders(ctx)

        if not (otu_drift or sequence_drift or order_drift):
            logger.info("otu and sequence stores match; no drift")
            return

        if attempt < _GATE_ATTEMPTS - 1:
            logger.info(
                "drift found; re-reading both stores before reporting it",
                otus=len(otu_drift),
                sequences=len(sequence_drift),
                orders=len(order_drift),
            )

            await asyncio.sleep(_GATE_SETTLE_DELAY)

    for report in otu_drift:
        logger.error("otu drift", **report)

    for report in sequence_drift:
        logger.error("sequence drift", **report)

    for report in order_drift:
        logger.error("sequence order drift", **report)

    msg = (
        f"store drift detected in {len(otu_drift)} otus, "
        f"{len(sequence_drift)} sequences and "
        f"{len(order_drift)} otu sequence orders"
    )
    raise ValueError(msg)


async def _compare_otus(ctx: MigrationContext) -> list[dict]:
    """Compare the Mongo ``otus`` collection against ``legacy_otus``.

    The scan and the verification of its candidates run in separate sessions so
    the verification really re-reads each row. See
    :func:`compare_otu_and_sequence_stores`.
    """
    mongo_ids = {
        document["_id"]
        async for document in ctx.mongo.otus.find({}, projection=["_id"])
    }

    reference_id_cache: dict[int | str, int] = {}

    async with AsyncSession(ctx.pg) as session:
        postgres_ids = {row[0] for row in await session.execute(select(SQLOTU.id))}

        candidates = mongo_ids ^ postgres_ids
        shared = sorted(mongo_ids & postgres_ids)

        for start in range(0, len(shared), _OTU_CHUNK_SIZE):
            chunk = shared[start : start + _OTU_CHUNK_SIZE]

            documents = {
                document["_id"]: document
                async for document in ctx.mongo.otus.find({"_id": {"$in": chunk}})
            }

            rows = {
                row.id: row
                for row in (
                    await session.execute(select(SQLOTU).where(SQLOTU.id.in_(chunk)))
                ).scalars()
            }

            for otu_id in chunk:
                document = documents.get(otu_id)
                row = rows.get(otu_id)

                if document is None or row is None:
                    candidates.add(otu_id)
                    continue

                reference_id = await _lookup_reference_id(
                    session,
                    document["reference"]["id"],
                    reference_id_cache,
                )

                if reference_id is None or _diff_otu(row, document, reference_id):
                    candidates.add(otu_id)

    async with AsyncSession(ctx.pg) as session:
        drifted = [
            report
            for otu_id in sorted(candidates)
            if (report := await _verify_otu(ctx, session, otu_id, reference_id_cache))
        ]

    logger.info("compared otus", otus=len(mongo_ids), drifted=len(drifted))

    return drifted


async def _compare_sequences(ctx: MigrationContext) -> list[dict]:
    """Compare the Mongo ``sequences`` collection against ``legacy_sequences``.

    A sequence whose parent OTU has no ``legacy_otus`` row cannot have a
    ``legacy_sequences`` row either -- the not-null foreign key would reject it --
    so such a sequence surfaces here as missing from Postgres.

    The scan and the verification of its candidates run in separate sessions so
    the verification really re-reads each row. See
    :func:`compare_otu_and_sequence_stores`.
    """
    mongo_ids = {
        document["_id"]
        async for document in ctx.mongo.sequences.find({}, projection=["_id"])
    }

    async with AsyncSession(ctx.pg) as session:
        postgres_ids = {row[0] for row in await session.execute(select(SQLSequence.id))}

        candidates = mongo_ids ^ postgres_ids
        shared = sorted(mongo_ids & postgres_ids)

        for start in range(0, len(shared), _SEQUENCE_CHUNK_SIZE):
            chunk = shared[start : start + _SEQUENCE_CHUNK_SIZE]

            documents = {
                document["_id"]: document
                async for document in ctx.mongo.sequences.find(
                    {"_id": {"$in": chunk}},
                )
            }

            rows = {
                row.id: row
                for row in (
                    await session.execute(
                        select(SQLSequence).where(SQLSequence.id.in_(chunk)),
                    )
                ).scalars()
            }

            for sequence_id in chunk:
                document = documents.get(sequence_id)
                row = rows.get(sequence_id)

                if document is None or row is None or _diff_sequence(row, document):
                    candidates.add(sequence_id)

    async with AsyncSession(ctx.pg) as session:
        drifted = [
            report
            for sequence_id in sorted(candidates)
            if (report := await _verify_sequence(ctx, session, sequence_id))
        ]

    logger.info(
        "compared sequences",
        sequences=len(mongo_ids),
        drifted=len(drifted),
    )

    return drifted


async def _compare_sequence_orders(ctx: MigrationContext) -> list[dict]:
    """Compare each OTU's Postgres sequence order against Mongo's cursor order.

    Runs the same two-pass candidate/re-verify structure as the document checks, so
    an OTU whose sequences the application changed between the two reads is not
    mistaken for drift. See :func:`compare_otu_and_sequence_stores`.
    """
    otu_ids = [
        document["_id"]
        async for document in ctx.mongo.otus.find({}, projection=["_id"])
    ]

    async with AsyncSession(ctx.pg) as session:
        candidates = [
            otu_id
            for otu_id in otu_ids
            if await _compare_otu_sequence_order(ctx, session, otu_id)
        ]

    async with AsyncSession(ctx.pg) as session:
        drifted = [
            report
            for otu_id in candidates
            if (report := await _compare_otu_sequence_order(ctx, session, otu_id))
        ]

    logger.info("compared sequence orders", otus=len(otu_ids), drifted=len(drifted))

    return drifted


async def _compare_otu_sequence_order(
    ctx: MigrationContext,
    session: AsyncSession,
    otu_id: str,
) -> dict | None:
    """Report an OTU whose Postgres sequence order does not match Mongo's.

    The rows are ordered by ``position`` and then by ``id``, which is unique. Ordering
    on ``position`` alone leaves rows that share one in whatever order the plan happens
    to emit them, so a check that passed once could fail on the next plan -- and, worse,
    could pass here by luck on an OTU whose order is not actually determined. The
    tie-break makes the comparison reproducible; the duplicate check below is what
    fails it.
    """
    mongo_ids = [
        document["_id"]
        async for document in ctx.mongo.sequences.find(
            {"otu_id": otu_id},
            projection=["_id"],
        )
    ]

    rows = (
        await session.execute(
            select(SQLSequence.id, SQLSequence.position)
            .where(SQLSequence.otu_id == otu_id)
            .order_by(SQLSequence.position, SQLSequence.id),
        )
    ).all()

    if any(row.position is None for row in rows):
        return {
            "otu_id": otu_id,
            "issue": "sequences without a position",
            "sequence_ids": [row.id for row in rows if row.position is None],
        }

    duplicated = {
        position
        for position, count in Counter(row.position for row in rows).items()
        if count > 1
    }

    if duplicated:
        return {
            "otu_id": otu_id,
            "issue": "sequences sharing a position",
            "positions": sorted(duplicated),
            "sequence_ids": [row.id for row in rows if row.position in duplicated],
        }

    postgres_ids = [row.id for row in rows]

    if mongo_ids != postgres_ids:
        return {
            "otu_id": otu_id,
            "issue": "sequence order differs",
            "mongo": mongo_ids,
            "postgres": postgres_ids,
        }

    return None


async def _verify_otu(
    ctx: MigrationContext,
    session: AsyncSession,
    otu_id: str,
    cache: dict[int | str, int],
) -> dict | None:
    """Re-read one candidate OTU from both stores and report it if it still drifts.

    Returns ``None`` when the candidate turns out to agree after all, which happens
    when the application wrote or deleted the OTU between the reads that flagged it.
    """
    document = await ctx.mongo.otus.find_one({"_id": otu_id})

    row = (
        await session.execute(select(SQLOTU).where(SQLOTU.id == otu_id))
    ).scalar_one_or_none()

    if document is None and row is None:
        return None

    if document is None:
        return {"otu_id": otu_id, "issue": "missing from mongo"}

    if row is None:
        return {"otu_id": otu_id, "issue": "missing from postgres"}

    reference = document["reference"]["id"]
    reference_id = await _lookup_reference_id(session, reference, cache)

    if reference_id is None:
        return {
            "otu_id": otu_id,
            "issue": "reference missing from postgres",
            "reference": reference,
        }

    differences = _diff_otu(row, document, reference_id)

    if differences:
        return {"otu_id": otu_id, "differences": differences}

    return None


async def _verify_sequence(
    ctx: MigrationContext,
    session: AsyncSession,
    sequence_id: str,
) -> dict | None:
    """Re-read one candidate sequence from both stores and report remaining drift.

    Returns ``None`` when the candidate turns out to agree after all. See
    :func:`_verify_otu`.
    """
    document = await ctx.mongo.sequences.find_one({"_id": sequence_id})

    row = (
        await session.execute(select(SQLSequence).where(SQLSequence.id == sequence_id))
    ).scalar_one_or_none()

    if document is None and row is None:
        return None

    if document is None:
        return {"sequence_id": sequence_id, "issue": "missing from mongo"}

    if row is None:
        return {"sequence_id": sequence_id, "issue": "missing from postgres"}

    differences = _diff_sequence(row, document)

    if differences:
        return {"sequence_id": sequence_id, "differences": differences}

    return None


def _diff_otu(
    row: SQLOTU,
    document: Document,
    reference_id: int,
) -> dict[str, dict]:
    """Diff a ``legacy_otus`` row against the Mongo document it mirrors."""
    return _diff_row(
        row,
        otu_row_values(document, reference_id),
        document,
        otu_document_from_row(row),
    )


def _diff_sequence(row: SQLSequence, document: Document) -> dict[str, dict]:
    """Diff a ``legacy_sequences`` row against the Mongo document it mirrors."""
    return _diff_row(
        row,
        sequence_row_values(document),
        document,
        sequence_document_from_row(row),
    )


def _diff_row(
    row: SQLOTU | SQLSequence,
    expected: dict[str, Any],
    document: Document,
    recovered: Document,
) -> dict[str, dict]:
    """Diff a row's promoted columns and the document the read path recovers from it.

    ``data`` is not compared column-to-column. What matters is that the read path can
    recover the Mongo document from the row, so ``recovered`` -- the row passed back
    through that path -- is compared against the document itself, and reported by the
    top-level keys that differ rather than whole, so a report stays readable when one
    field of a large document drifted.
    """
    differences: dict[str, dict] = {
        column: {"mongo": value, "postgres": getattr(row, column)}
        for column, value in expected.items()
        if column != "data" and getattr(row, column) != value
    }

    if recovered != document:
        differences["document"] = _diff_data(document, recovered)

    return differences


def _diff_data(mongo_data: Document, postgres_data: Document) -> dict[str, dict]:
    """Diff the Mongo document against the ``data`` JSONB, key by top-level key."""
    return {
        key: {"mongo": mongo_data.get(key), "postgres": postgres_data.get(key)}
        for key in sorted(set(mongo_data) | set(postgres_data))
        if mongo_data.get(key) != postgres_data.get(key)
    }
