"""Work with OTUs in the database."""

from collections import Counter
from collections.abc import Collection
from datetime import datetime
from typing import Any

from motor.motor_asyncio import AsyncIOMotorClientSession
from sqlalchemy import delete, distinct, func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

import virtool.history.db
import virtool.otus.utils
from virtool.api.custom_json import isoformat_to_datetime
from virtool.api.utils import compose_regex_query, paginate
from virtool.data.topg import (
    compose_legacy_id_mongo_match,
    compose_legacy_id_subquery,
    resolve_legacy_id,
)
from virtool.data.transforms import apply_transforms
from virtool.errors import DatabaseError
from virtool.history.sql import SQLLegacyHistory
from virtool.mongo.core import Mongo
from virtool.mongo.utils import get_one_field
from virtool.otus.sql import SQLOTU, SQLSequence
from virtool.references.sql import SQLReference
from virtool.references.transforms import AttachReferenceTransform
from virtool.types import Document
from virtool.utils import base_processor, to_bool

SEQUENCE_PROJECTION = (
    "_id",
    "accession",
    "definition",
    "host",
    "otu_id",
    "isolate_id",
    "reference",
    "sequence",
    "segment",
)


async def check_name_and_abbreviation(
    mongo: "Mongo",
    pg: AsyncEngine,
    ref_id: str,
    name: str | None = None,
    abbreviation: str | None = None,
) -> str | None:
    """Check of an OTU name and abbreviation are already in use.

    Returns an error message if the ``name`` or ``abbreviation`` are already in use.

    :param mongo: the application database client
    :param pg: the application PostgreSQL engine
    :param ref_id: the id of the reference to check in
    :param name: an OTU name
    :param abbreviation: an OTU abbreviation

    """
    reference_id_match = await compose_legacy_id_mongo_match(pg, SQLReference, ref_id)

    name_exists = name and await mongo.otus.count_documents(
        {"lower_name": name.lower(), "reference.id": reference_id_match},
        limit=1,
    )

    abbreviation_exists = abbreviation and await mongo.otus.count_documents(
        {"abbreviation": abbreviation, "reference.id": reference_id_match},
        limit=1,
    )

    if name_exists and abbreviation_exists:
        return "Name and abbreviation already exist"

    if name_exists:
        return "Name already exists"

    if abbreviation_exists:
        return "Abbreviation already exists"


async def find(
    mongo: "Mongo",
    pg: AsyncEngine,
    term: str | None,
    page: int,
    per_page: int,
    verified: bool | None,
    ref_id: str | None = None,
) -> dict[str, Any] | list[dict | None]:
    mongo_query = {}

    if term:
        mongo_query.update(compose_regex_query(term, ["name", "abbreviation"]))

    if verified is not None:
        mongo_query["verified"] = to_bool(verified)

    base_query = None

    if ref_id is not None:
        base_query = {
            "reference.id": await compose_legacy_id_mongo_match(
                pg, SQLReference, ref_id
            ),
        }

    data = await paginate(
        mongo.otus,
        mongo_query,
        page,
        per_page,
        base_query=base_query,
        sort="name",
        projection=["_id", "abbreviation", "name", "reference", "verified", "version"],
    )

    data["documents"] = await apply_transforms(
        [base_processor(d) for d in data["documents"]],
        [AttachReferenceTransform(pg)],
        pg,
    )

    history_filters = [SQLLegacyHistory.index.is_(None)]

    if ref_id:
        history_filters.append(
            SQLLegacyHistory.reference_id
            == compose_legacy_id_subquery(SQLReference, ref_id),
        )

    async with AsyncSession(pg) as session:
        data["modified_count"] = await session.scalar(
            select(func.count(distinct(SQLLegacyHistory.otu))).where(
                *history_filters,
            ),
        )

    return data


async def join(
    mongo: "Mongo",
    query: dict | str,
    document: dict[str, Any] | None = None,
    session: AsyncIOMotorClientSession | None = None,
) -> dict[str, Any] | None:
    """Join the otu associated with the supplied ``otu_id`` with its sequences.

    If an OTU is passed, the document will not be pulled from the database.

    :param mongo: the application database client
    :param query: the id of the otu to join or a Mongo query.
    :param document: use this otu document as a basis for the join
    :param session: a Motor session to use for database operations
    :return: the joined otu document
    """
    # Get the otu entry if a ``document`` parameter was not passed.
    document = document or await mongo.otus.find_one(query, session=session)

    if document is None:
        return None

    cursor = mongo.sequences.find({"otu_id": document["_id"]}, session=session)

    # Merge the sequence entries into the otu entry.
    return virtool.otus.utils.merge_otu(document, [d async for d in cursor])


async def join_and_format(
    mongo: "Mongo",
    pg: AsyncEngine,
    otu_id: str,
    joined: dict | None = None,
    issues: dict | bool | None = False,
) -> dict | None:
    """Join the otu identified by the passed ``otu_id``.

    Reuses the ``joined`` otu document if available to save a database query. Then,
    format the joined otu into a format that can be directly returned to API clients.

    :param mongo: the application database client
    :param pg: the application PostgreSQL database object
    :param otu_id: the id of the otu to join
    :param joined:
    :param issues: an object describing issues in the otu
    :return: a joined and formatted otu

    """
    joined = joined or await join(mongo, otu_id)

    if not joined:
        return None

    most_recent_change = await virtool.history.db.get_most_recent_change(pg, otu_id)

    if issues is False:
        issues = await verify(mongo, otu_id)

    return virtool.otus.utils.format_otu(joined, issues, most_recent_change)


async def verify(mongo: "Mongo", otu_id: str, joined: dict = None) -> dict | None:
    """Verifies that the associated otu is ready to be included in an index rebuild.

    Returns verification errors if necessary.

    """
    joined = joined or await join(mongo, otu_id)

    if not joined:
        raise DatabaseError(f"Could not find otu '{otu_id}'")

    return virtool.otus.utils.verify(joined)


async def increment_otu_version(
    mongo: "Mongo",
    otu_id: str,
    session: AsyncIOMotorClientSession | None = None,
) -> Document:
    """Increment the `version` field by one for the OTU identified by `otu_id`.

    :param mongo: the application database client
    :param otu_id: the ID of the OTU whose version should be increased
    :param session: a Motor session to use for database operations
    :return: the updated OTU document

    """
    return await mongo.otus.find_one_and_update(
        {"_id": otu_id},
        {"$set": {"verified": False}, "$inc": {"version": 1}},
        session=session,
    )


async def update_otu_verification(
    mongo: "Mongo",
    joined: dict,
    session: AsyncIOMotorClientSession | None = None,
) -> dict | None:
    issues = virtool.otus.utils.verify(joined)

    if issues is None:
        await mongo.otus.update_one(
            {"_id": joined["_id"]},
            {"$set": {"verified": True}},
            session=session,
        )
        joined["verified"] = True

    return issues


def _encode_otu_data(document: Document) -> Document:
    """Render a Mongo OTU ``document`` as the ``data`` JSONB column must store it.

    Only OTUs created by a reference import or clone carry a ``created_at``, and only
    the bulk insert path writes one that never round-tripped through Mongo. BSON holds
    a datetime as int64 milliseconds and drops the microseconds, while the engine's
    JSON serializer would write every one of them. Flooring to the millisecond -- the
    same truncation pymongo applies -- means the stored ISO string is exactly the
    instant Mongo holds, so ``data`` stays a faithful lift of the document.

    ``created_at`` is rewritten on a copy, never in place, because the caller keeps
    using the document it passed: the bulk insert path hands that very dict to
    ``mongo.otus.insert_many`` afterwards, and the OTU data layer reuses it for history
    diffs and returns it. A document with no ``created_at`` to rewrite -- every OTU
    created through the API -- is returned as-is.
    """
    created_at = document.get("created_at")

    if not isinstance(created_at, datetime):
        return document

    return {
        **document,
        "created_at": created_at.replace(
            microsecond=created_at.microsecond // 1000 * 1000,
        ),
    }


def otu_document_from_row(row: SQLOTU) -> Document:
    """Recover the Mongo OTU document a ``legacy_otus`` row was written from.

    The inverse of :func:`_encode_otu_data`. A JSONB column cannot hold a datetime, so
    ``created_at`` comes back out as the ISO string it was stored as and is parsed back
    to the naive datetime the rest of the codebase expects. OTUs created through the API
    carry no ``created_at`` at all, so its absence is normal rather than an error.
    """
    document = row.data

    created_at = document.get("created_at")

    if created_at is None:
        return document

    return {**document, "created_at": isoformat_to_datetime(created_at)}


def sequence_document_from_row(row: SQLSequence) -> Document:
    """Recover the Mongo sequence document a ``legacy_sequences`` row was written from.

    A passthrough. Sequence documents hold nothing JSON cannot express -- no datetimes
    in particular -- so the column returns what was put in it. It exists so the read
    path has one obvious entry point per collection, matching
    :func:`otu_document_from_row`.
    """
    return row.data


def otu_row_values(document: Document, reference_id: int) -> dict[str, Any]:
    """Map a Mongo OTU ``document`` to ``legacy_otus`` column values.

    The whole document is stored verbatim in ``data``, save for the millisecond
    truncation :func:`_encode_otu_data` applies to ``created_at`` so the column can
    hold it. The remaining columns are promoted from the document so they can be
    queried, filtered and sorted directly.
    """
    return {
        "id": document["_id"],
        "data": _encode_otu_data(document),
        "name": document["name"],
        "abbreviation": document.get("abbreviation") or "",
        "reference_id": reference_id,
        "verified": document["verified"],
        "version": document["version"],
    }


def sequence_row_values(document: Document) -> dict[str, Any]:
    """Map a Mongo sequence ``document`` to ``legacy_sequences`` column values.

    ``position`` is deliberately absent. It orders a sequence within its OTU and so
    cannot be derived from the document alone; every write path supplies it
    separately.
    """
    return {
        "id": document["_id"],
        "data": document,
        "otu_id": document["otu_id"],
        "isolate_id": document["isolate_id"],
        "segment": document.get("segment"),
    }


def next_sequence_position(otu_id: str):
    """Compose a scalar subquery for the next free ``position`` in an OTU.

    Evaluated by Postgres inside the insert, so the read and the write cannot be
    interleaved. Callers hold the OTU's :func:`lock_legacy_otu` row lock, which
    serializes concurrent appends to the same OTU.
    """
    return (
        select(func.coalesce(func.max(SQLSequence.position) + 1, 0))
        .where(SQLSequence.otu_id == otu_id)
        .scalar_subquery()
    )


_MAX_BIND_PARAMETERS = 32767
"""The most bind parameters asyncpg will accept in one statement."""

_OTU_ROW_CHUNK_SIZE = _MAX_BIND_PARAMETERS // 7
"""Max ``legacy_otus`` rows per statement.

Each row binds the seven columns produced by :func:`otu_row_values`.
"""

_SEQUENCE_ROW_CHUNK_SIZE = _MAX_BIND_PARAMETERS // 6
"""Max ``legacy_sequences`` rows per statement.

Each row binds the five columns produced by :func:`sequence_row_values` plus
``position``. An upsert's conflict update binds nothing further: the values it writes
come from the ``excluded`` pseudo-table, which is the row that was already bound for
the insert.
"""

_SEQUENCE_ID_CHUNK_SIZE = _MAX_BIND_PARAMETERS
"""Max ``legacy_sequences`` ids per statement.

An id in an ``IN`` list binds one parameter and nothing else in the statement binds
any.
"""


async def bulk_insert_otu_rows(
    pg_session: AsyncSession,
    documents: list[Document],
    reference_id: int,
) -> None:
    """Insert ``legacy_otus`` rows for ``documents`` into ``pg_session``.

    Every row's ``reference_id`` column is set to the resolved ``reference_id``
    primary key. The rows are written in asyncpg-safe chunks without committing, so
    they commit or roll back together with the caller's surrounding transaction.
    """
    if not documents:
        return

    rows = [otu_row_values(document, reference_id) for document in documents]

    for start in range(0, len(rows), _OTU_ROW_CHUNK_SIZE):
        await pg_session.execute(
            pg_insert(SQLOTU).values(rows[start : start + _OTU_ROW_CHUNK_SIZE]),
        )


def _positioned_sequence_rows(documents: list[Document]) -> list[dict[str, Any]]:
    """Map sequence ``documents`` to ``legacy_sequences`` column values with positions.

    ``position`` is assigned by counting off each OTU's sequences in the order they
    appear in ``documents``. Every caller hands them over in the order Mongo holds
    them -- the order ``sequences.insert_many`` was given them in, or the order an
    unsorted ``find({"otu_id": otu_id})`` returns them in -- so it is the Mongo
    natural order the rows must reproduce.

    Callers pass whole OTUs at a time, so an OTU's sequences are never split across
    two calls and the count always starts at zero for a new OTU.
    """
    positions = Counter()
    rows = []

    for document in documents:
        otu_id = document["otu_id"]

        rows.append({**sequence_row_values(document), "position": positions[otu_id]})

        positions[otu_id] += 1

    return rows


async def _upsert_sequence_rows(
    pg_session: AsyncSession,
    rows: list[dict[str, Any]],
    updated_columns: Collection[str],
) -> None:
    """Upsert ``legacy_sequences`` ``rows`` into ``pg_session`` in asyncpg-safe chunks.

    ``updated_columns`` names the columns a row that already exists has rewritten from
    the row that would have been inserted. Their values are taken from the ``excluded``
    pseudo-table -- the proposed row -- rather than re-bound, so a chunk carries each
    row's values exactly once however many columns the conflict updates.

    One statement per chunk rather than one per row. A caller holds the OTU's
    :func:`lock_legacy_otu` row lock across the whole write, so every round trip saved
    is lock time a concurrent dual-write to that OTU does not spend blocked.

    The rows are written without committing, so they commit or roll back together with
    the caller's surrounding transaction.
    """
    for start in range(0, len(rows), _SEQUENCE_ROW_CHUNK_SIZE):
        statement = pg_insert(SQLSequence).values(
            rows[start : start + _SEQUENCE_ROW_CHUNK_SIZE],
        )

        await pg_session.execute(
            statement.on_conflict_do_update(
                index_elements=["id"],
                set_={column: statement.excluded[column] for column in updated_columns},
            ),
        )


async def bulk_insert_sequence_rows(
    pg_session: AsyncSession,
    documents: list[Document],
) -> None:
    """Insert ``legacy_sequences`` rows for ``documents`` into ``pg_session``.

    ``position`` counts off each OTU's sequences in the order they appear in
    ``documents``; see :func:`_positioned_sequence_rows`.

    The rows are written in asyncpg-safe chunks without committing, so they commit
    or roll back together with the caller's surrounding transaction.
    """
    if not documents:
        return

    rows = _positioned_sequence_rows(documents)

    for start in range(0, len(rows), _SEQUENCE_ROW_CHUNK_SIZE):
        await pg_session.execute(
            pg_insert(SQLSequence).values(
                rows[start : start + _SEQUENCE_ROW_CHUNK_SIZE],
            ),
        )


async def bulk_upsert_sequence_rows(
    pg_session: AsyncSession,
    documents: list[Document],
) -> None:
    """Rewrite ``legacy_sequences`` rows for ``documents`` from those documents.

    Every column is rewritten, ``position`` included: the rows are made to say exactly
    what the documents say, in the order the documents were handed over. Used by the
    reconciliation, which owns an OTU's sequence order, and so is the one path that may
    renumber a sequence that already has a row.

    ``documents`` must be one OTU's sequences, in the order Mongo returns them.
    """
    if not documents:
        return

    rows = _positioned_sequence_rows(documents)

    await _upsert_sequence_rows(
        pg_session,
        rows,
        [column for column in rows[0] if column != "id"],
    )


async def bulk_position_sequence_rows(
    pg_session: AsyncSession,
    documents: list[Document],
) -> None:
    """Assign ``legacy_sequences`` rows for ``documents`` their position in their OTU.

    Only ``position`` is rewritten on a row that already exists; a row that does not
    exist yet is inserted whole. Used by the position backfill, which owns the ordering
    of an OTU's sequences but not their contents.

    ``documents`` must be one OTU's sequences, in the order Mongo returns them.
    """
    if not documents:
        return

    await _upsert_sequence_rows(
        pg_session,
        _positioned_sequence_rows(documents),
        ["position"],
    )


async def lock_legacy_otu(pg_session: AsyncSession, otu_id: str) -> None:
    """Take a ``SELECT … FOR UPDATE`` lock on an OTU's ``legacy_otus`` row.

    Serializes concurrent edits to the same OTU so no version bump is lost. Call it
    before the first Mongo read in a write transaction so the Mongo snapshot is taken
    after the lock is held. A no-op while the OTU has no Postgres row yet (not
    backfilled); the Mongo transaction still guards the bump in that transient window.
    """
    await pg_session.execute(
        select(SQLOTU.id).where(SQLOTU.id == otu_id).with_for_update(),
    )


async def write_legacy_otu(pg_session: AsyncSession, document: Document) -> None:
    """Upsert a Mongo OTU ``document`` into ``legacy_otus`` within ``pg_session``.

    The embedded ``reference.id`` is resolved to the integer ``legacy_references``
    primary key. Every promoted column is recomputed from the document, so the same
    call serves inserts and updates and keeps the row in sync on each whole-document
    write.
    """
    reference_id = await resolve_legacy_id(
        pg_session,
        SQLReference,
        document["reference"]["id"],
    )

    if reference_id is None:
        raise ValueError(
            f"Reference {document['reference']['id']!r} not found in postgres",
        )

    values = otu_row_values(document, reference_id)

    await pg_session.execute(
        pg_insert(SQLOTU)
        .values(**values)
        .on_conflict_do_update(
            index_elements=["id"],
            set_={key: value for key, value in values.items() if key != "id"},
        ),
    )


async def write_legacy_sequence(pg_session: AsyncSession, document: Document) -> None:
    """Upsert a Mongo sequence ``document`` into ``legacy_sequences`` within
    ``pg_session``.

    A new sequence is appended to the end of its OTU. An existing one keeps the
    ``position`` it already holds: the column is left out of the conflict update so
    re-mirroring a sequence never renumbers it and never reorders the OTU.
    """
    values = sequence_row_values(document)

    await pg_session.execute(
        pg_insert(SQLSequence)
        .values(**values, position=next_sequence_position(document["otu_id"]))
        .on_conflict_do_update(
            index_elements=["id"],
            set_={key: value for key, value in values.items() if key != "id"},
        ),
    )


async def delete_legacy_otu(pg_session: AsyncSession, otu_id: str) -> int:
    """Delete an OTU's ``legacy_otus`` row; its ``legacy_sequences`` rows cascade.

    Returns how many rows were deleted: one, or zero if the OTU had no row to begin
    with.

    The row is deleted without committing, so it goes or comes back together with the
    caller's surrounding transaction.
    """
    result = await pg_session.execute(delete(SQLOTU).where(SQLOTU.id == otu_id))

    return result.rowcount


async def delete_legacy_sequence(pg_session: AsyncSession, sequence_id: str) -> None:
    """Delete a single ``legacy_sequences`` row by id."""
    await pg_session.execute(delete(SQLSequence).where(SQLSequence.id == sequence_id))


async def delete_legacy_sequences(
    pg_session: AsyncSession,
    sequence_ids: Collection[str],
) -> int:
    """Delete ``legacy_sequences`` rows by id; return how many were deleted.

    Each id binds one parameter, so the ids are deleted in asyncpg-safe chunks: a
    single statement carrying more of them than the driver's cap would fail with an
    opaque driver error rather than deleting anything.

    The rows are deleted without committing, so they go or come back together with the
    caller's surrounding transaction.
    """
    ids = list(sequence_ids)

    deleted = 0

    for start in range(0, len(ids), _SEQUENCE_ID_CHUNK_SIZE):
        result = await pg_session.execute(
            delete(SQLSequence).where(
                SQLSequence.id.in_(ids[start : start + _SEQUENCE_ID_CHUNK_SIZE]),
            ),
        )

        deleted += result.rowcount

    return deleted


async def delete_legacy_isolate_sequences(
    pg_session: AsyncSession,
    otu_id: str,
    isolate_id: str,
) -> None:
    """Delete every ``legacy_sequences`` row belonging to an isolate."""
    await pg_session.execute(
        delete(SQLSequence).where(
            SQLSequence.otu_id == otu_id,
            SQLSequence.isolate_id == isolate_id,
        ),
    )


async def update_sequence_segments(
    mongo: "Mongo",
    old: dict,
    new: dict,
    session: AsyncIOMotorClientSession | None = None,
) -> None:
    if old is None or new is None or "schema" not in old:
        return

    old_names = {s["name"] for s in old["schema"]}
    new_names = {s["name"] for s in new["schema"]}

    if old_names != new_names:
        await mongo.sequences.update_many(
            {"otu_id": old["_id"], "segment": {"$in": list(old_names - new_names)}},
            {"$unset": {"segment": ""}},
            session=session,
        )


async def check_sequence_segment(
    mongo: "Mongo",
    otu_id: str,
    data: dict,
) -> str | None:
    """Check that the segment field is compatible with the parent OTU.

    Returns an error message string if the segment provided in `data` is not defined in
    the parent OTU's schema.

    Returns `None` if the check passes.

    :param mongo: the application database object
    :param otu_id: the ID of the parent OTU
    :param data: the data dict containing a segment value
    :return: message or `None` if check passes

    """
    if data.get("segment"):
        schema = await get_one_field(mongo.otus, "schema", otu_id) or []

        segment = data.get("segment")

        if segment not in {s["name"] for s in schema}:
            return f"Segment {segment} is not defined for the parent OTU"
