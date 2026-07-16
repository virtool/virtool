"""Work with OTUs in the database."""

import math
from collections import Counter, defaultdict
from collections.abc import Collection
from datetime import datetime
from typing import Any

from motor.motor_asyncio import AsyncIOMotorClientSession
from sqlalchemy import delete, distinct, func, or_, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

import virtool.history.db
import virtool.otus.utils
from virtool.api.custom_json import isoformat_to_datetime
from virtool.data.topg import (
    compose_legacy_id_subquery,
    resolve_legacy_id,
)
from virtool.data.transforms import apply_transforms
from virtool.history.sql import SQLLegacyHistory
from virtool.mongo.core import Mongo
from virtool.otus.sql import SQLOTU, SQLSequence
from virtool.references.sql import SQLReference
from virtool.references.transforms import AttachReferenceTransform
from virtool.types import Document


def compose_otu_search_filter(term: str):
    """Compose a case-insensitive substring match on ``name`` and ``abbreviation``.

    Mirrors the Mongo ``compose_regex_query`` behaviour the find endpoint used before
    reading from Postgres: the term is matched literally, so SQL ``LIKE`` wildcards in
    the term are escaped rather than interpreted.
    """
    escaped = term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    pattern = f"%{escaped}%"

    return or_(
        SQLOTU.name.ilike(pattern, escape="\\"),
        SQLOTU.abbreviation.ilike(pattern, escape="\\"),
    )


async def check_name_and_abbreviation(
    pg: AsyncEngine,
    ref_id: int | str,
    name: str | None = None,
    abbreviation: str | None = None,
) -> str | None:
    """Check of an OTU name and abbreviation are already in use.

    Returns an error message if the ``name`` or ``abbreviation`` are already in use.

    The name is matched on ``lower(name)`` rather than the ``lower_name`` field the
    Mongo query used. The ``legacy_otus_name_lower`` index makes that expression a
    lookup rather than a scan, so the denormalised field does not need promoting to a
    column of its own.

    :param pg: the application PostgreSQL engine
    :param ref_id: the id of the reference to check in
    :param name: an OTU name
    :param abbreviation: an OTU abbreviation

    """
    reference_id = compose_legacy_id_subquery(SQLReference, ref_id)

    async with AsyncSession(pg) as session:
        name_exists = bool(name) and await session.scalar(
            select(
                select(SQLOTU.id)
                .where(
                    func.lower(SQLOTU.name) == name.lower(),
                    SQLOTU.reference_id == reference_id,
                )
                .exists(),
            ),
        )

        abbreviation_exists = bool(abbreviation) and await session.scalar(
            select(
                select(SQLOTU.id)
                .where(
                    SQLOTU.abbreviation == abbreviation,
                    SQLOTU.reference_id == reference_id,
                )
                .exists(),
            ),
        )

    if name_exists and abbreviation_exists:
        return "Name and abbreviation already exist"

    if name_exists:
        return "Name already exists"

    if abbreviation_exists:
        return "Abbreviation already exists"

    return None


async def find(
    pg: AsyncEngine,
    term: str | None,
    page: int,
    per_page: int,
    verified: bool | None,
    ref_id: int | str | None = None,
) -> dict[str, Any]:
    """Find OTUs matching a search term, in ``paginate``'s result shape.

    ``ref_id`` scopes both counts, so ``total_count`` is the size of the reference
    rather than of every OTU, exactly as the ``base_query`` it replaces did.

    Only the promoted columns behind :class:`virtool.otus.models.OTUMinimal` are
    selected, standing in for the projection the Mongo query passed. Selecting whole
    rows would drag the entire ``data`` JSONB -- every isolate of every OTU on the page
    -- over the wire to build a response that names none of it.

    Rows are ordered by ``lower(name)`` then ``id``, which the ``legacy_otus_name_lower``
    index covers. This is a deliberate change of order rather than a port of the Mongo
    one: ``sort="name"`` collated by byte value, so it filed every capitalised name ahead
    of every lowercase one, and it had no tiebreaker, so OTUs sharing a name could swap
    places between pages of one walk. Case-folding gives the alphabetical order the
    endpoint has always appeared to promise, and ``id`` makes paging stable.
    """
    base_filters = []

    if ref_id is not None:
        base_filters.append(
            SQLOTU.reference_id == compose_legacy_id_subquery(SQLReference, ref_id),
        )

    search_filters = list(base_filters)

    if term:
        search_filters.append(compose_otu_search_filter(term))

    if verified is not None:
        search_filters.append(SQLOTU.verified.is_(verified))

    history_filters = [SQLLegacyHistory.index.is_(None)]

    if ref_id:
        history_filters.append(
            SQLLegacyHistory.reference_id
            == compose_legacy_id_subquery(SQLReference, ref_id),
        )

    async with AsyncSession(pg) as session:
        total_count = await session.scalar(
            select(func.count()).select_from(SQLOTU).where(*base_filters),
        )

        found_count = await session.scalar(
            select(func.count()).select_from(SQLOTU).where(*search_filters),
        )

        rows = (
            await session.execute(
                select(
                    SQLOTU.id,
                    SQLOTU.abbreviation,
                    SQLOTU.name,
                    SQLOTU.reference_id,
                    SQLOTU.verified,
                    SQLOTU.version,
                )
                .where(*search_filters)
                .order_by(func.lower(SQLOTU.name), SQLOTU.id)
                .offset(per_page * (page - 1))
                .limit(per_page),
            )
        ).all()

        modified_count = await session.scalar(
            select(func.count(distinct(SQLLegacyHistory.otu))).where(*history_filters),
        )

    documents = await apply_transforms(
        [
            {
                "id": row.id,
                "abbreviation": row.abbreviation,
                "name": row.name,
                "reference": {"id": row.reference_id},
                "verified": row.verified,
                "version": row.version,
            }
            for row in rows
        ],
        [AttachReferenceTransform(pg)],
        pg,
    )

    return {
        "documents": documents,
        "total_count": total_count,
        "found_count": found_count,
        "page_count": int(math.ceil(found_count / per_page)),
        "per_page": per_page,
        "page": page,
        "modified_count": modified_count,
    }


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
    pg: AsyncEngine,
    otu_id: str,
    joined: dict | None = None,
    issues: dict | bool | None = False,
) -> dict | None:
    """Join the otu identified by the passed ``otu_id``.

    Reuses the ``joined`` otu document if available to save a database query. Then,
    format the joined otu into a format that can be directly returned to API clients.

    Unresolved ``issues`` are computed from the joined document in hand rather than by
    re-reading the OTU. The old Mongo path called :func:`verify`, which joined the OTU a
    second time purely to hand it to :func:`virtool.otus.utils.verify`; the two joins
    always described the same OTU, so collapsing them changes nothing but the query
    count.

    :param pg: the application PostgreSQL database object
    :param otu_id: the id of the otu to join
    :param joined: use this joined otu document rather than reading one
    :param issues: an object describing issues in the otu
    :return: a joined and formatted otu

    """
    joined = joined or await join_legacy_otu(pg, otu_id)

    if not joined:
        return None

    most_recent_change = await virtool.history.db.get_most_recent_change(pg, otu_id)

    if issues is False:
        issues = virtool.otus.utils.verify(joined)

    return virtool.otus.utils.format_otu(joined, issues, most_recent_change)


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


async def join_legacy_otu(pg: AsyncEngine, otu_id: str) -> Document | None:
    """Reconstruct a joined OTU document from Postgres in a session of its own.

    The Postgres counterpart of :func:`join`, and the read primitive OTU reads and
    :func:`virtool.history.db.patch_to_version` are built on. Sees only committed rows,
    which is what a read outside a write transaction wants.
    :func:`join_legacy_otu_in_session` is the variant for a caller that has to see its
    own uncommitted writes.
    """
    async with AsyncSession(pg) as session:
        return await join_legacy_otu_in_session(session, otu_id)


async def join_legacy_otus(
    pg: AsyncEngine,
    otu_ids: Collection[str],
) -> dict[str, Document]:
    """Reconstruct many joined OTU documents from Postgres in a session of its own.

    The batched counterpart of :func:`join_legacy_otu`, reading every requested OTU in
    two queries rather than two per OTU. A caller holding a set of OTUs to join -- an
    analysis formatting a hit per detected OTU, an index build walking a manifest --
    should reach for this rather than awaiting the single-OTU read in a loop or a
    ``gather``, which issues a query and takes a pool connection per OTU.

    Only the OTUs that have a row appear in the returned mapping, so a missing key
    carries what a ``None`` from :func:`join_legacy_otu` does.
    """
    async with AsyncSession(pg) as session:
        return await join_legacy_otus_in_session(session, otu_ids)


async def join_legacy_otu_in_session(
    pg_session: AsyncSession,
    otu_id: str,
) -> Document | None:
    """Reconstruct a joined OTU document from Postgres within ``pg_session``.

    Reads through the caller's session, so an OTU written earlier in the caller's
    transaction joins as it now stands rather than as it was last committed. The OTU
    write path needs this: it composes a history diff from the OTU before and after its
    own uncommitted writes. The session's lifecycle is left alone -- nothing here
    commits, rolls back or closes it. Returns ``None`` for an OTU that has no row, as
    :func:`join` does for one that has no document.

    A thin single-OTU face on :func:`join_legacy_otus_in_session`, which is where the
    read itself lives.
    """
    return (await join_legacy_otus_in_session(pg_session, [otu_id])).get(otu_id)


async def join_legacy_otus_in_session(
    pg_session: AsyncSession,
    otu_ids: Collection[str],
) -> dict[str, Document]:
    """Reconstruct joined OTU documents for ``otu_ids`` from Postgres within
    ``pg_session``.

    The read every OTU join in this codebase resolves to, batched or not. Reads through
    the caller's session on the same terms as :func:`join_legacy_otu_in_session`, and
    leaves its lifecycle alone.

    The OTUs are read in one query and their sequences in a second, so the cost is two
    queries and one pool connection however many OTUs are asked for.

    Both reads pass ``populate_existing`` so a row already in the session's identity map
    is refreshed from the database rather than handed back as it was first loaded. The
    write path upserts through Core DML (:func:`write_legacy_otu`), which does not
    synchronize the identity map, so a caller that joins an OTU, writes it and joins it
    again -- exactly the diff-composing sequence above -- can otherwise be handed its
    pre-write ``data`` the second time and diff the OTU against itself. Autoflush does
    not cover this: it pushes pending changes out, it does not invalidate what has
    already been loaded.

    Without ``populate_existing`` that second join is correct only by accident. The
    identity map holds its rows weakly, and this function keeps no reference to the ones
    it loads, so the stale row is usually collected before the rejoin and the lookup
    falls through to a fresh ``SELECT``. Anything else in the transaction that still
    holds the row -- a caller that read it itself, a lazy attribute, a debugger --
    pins it in the map and the stale read comes back. Read correctness cannot rest on
    garbage collection timing.

    Erasing pending object state is the documented cost of ``populate_existing`` and
    costs nothing here, because this domain's writes mutate no mapped objects.

    Both documents are recovered from the verbatim ``data`` JSONB column, via
    :func:`otu_document_from_row` and :func:`sequence_document_from_row`, rather than
    rebuilt from the promoted columns. Those columns are a lossy projection: they carry
    nothing of ``lower_name``, an isolate's fields, or a sequence's ``reference``, and
    ``abbreviation`` and ``segment`` are normalised on the way in. A joined OTU feeds
    ``dictdiffer`` diffs that address the document as it was written, so anything the
    projection drops or coerces would corrupt a patch rather than merely be absent from
    it.

    ``merge_otu`` is reused unchanged, so sequences are bucketed into isolates by
    ``isolate_id`` exactly as they are on the Mongo path, and an isolate with no
    sequences still gets an empty list.

    The sequences are ordered by ``position`` within their OTU, which reproduces the
    natural order Mongo's unsorted cursor returns them in. A ``NULL`` or duplicated
    position is not sorted around:
    :func:`virtool.otus.migration.compare_otu_and_sequence_stores` gates the read switch
    on neither existing, and quietly shuffling such an OTU's sequences would misapply
    every diff that addresses them by index -- the failure ``position`` exists to
    prevent.
    """
    otu_ids = set(otu_ids)

    if not otu_ids:
        return {}

    otu_rows = (
        await pg_session.scalars(
            select(SQLOTU)
            .where(SQLOTU.id.in_(otu_ids))
            .execution_options(populate_existing=True),
        )
    ).all()

    if not otu_rows:
        return {}

    sequence_rows = await pg_session.scalars(
        select(SQLSequence)
        .where(SQLSequence.otu_id.in_([otu_row.id for otu_row in otu_rows]))
        .order_by(SQLSequence.otu_id, SQLSequence.position)
        .execution_options(populate_existing=True),
    )

    sequence_documents = defaultdict(list)

    for sequence_row in sequence_rows:
        sequence_documents[sequence_row.otu_id].append(
            sequence_document_from_row(sequence_row),
        )

    return {
        otu_row.id: virtool.otus.utils.merge_otu(
            otu_document_from_row(otu_row),
            sequence_documents[otu_row.id],
        )
        for otu_row in otu_rows
    }


def compose_isolate_match(isolate_id: str):
    """Compose a match on an OTU that carries the isolate identified by ``isolate_id``.

    The Postgres counterpart of the Mongo ``{"isolates.id": isolate_id}`` predicate.
    Isolates are embedded in the OTU document rather than promoted to a table of their
    own, so the match is a JSONB containment test against the ``isolates`` array in
    ``data``. Containment is used rather than pulling the array back and scanning it in
    Python so an isolate-scoped read stays a single scalar query.
    """
    return SQLOTU.data["isolates"].contains([{"id": isolate_id}])


async def get_legacy_otu_reference_id(
    pg: AsyncEngine,
    otu_id: str,
    isolate_id: str | None = None,
) -> int | None:
    """Return the id of an OTU's parent reference, or ``None`` if it has no row.

    Backs the authorization reads on the OTU handlers, which need nothing about an OTU
    but the reference whose rights govern it. Only ``reference_id`` is selected, so the
    check never reads the ``data`` JSONB.

    When ``isolate_id`` is given the OTU must also carry that isolate, and ``None`` is
    returned if it does not. The handlers that take an isolate in their path rely on
    this: the read is their existence check for the isolate as well as for the OTU, and
    dropping the scope would turn a bad ``isolate_id`` into a ``403``/``200`` rather
    than the ``404`` it has always been.
    """
    filters = [SQLOTU.id == otu_id]

    if isolate_id is not None:
        filters.append(compose_isolate_match(isolate_id))

    async with AsyncSession(pg) as session:
        return await session.scalar(select(SQLOTU.reference_id).where(*filters))


async def legacy_isolate_exists(pg: AsyncEngine, otu_id: str, isolate_id: str) -> bool:
    """Return whether an OTU exists and carries the isolate identified by ``isolate_id``.

    The Postgres counterpart of the ``count_documents({"_id": otu_id, "isolates.id":
    isolate_id})`` guard the sequence reads use. Only the ``id`` column is selected, so
    the check never reads the ``data`` JSONB it matches against.
    """
    async with AsyncSession(pg) as session:
        return (
            await session.scalar(
                select(SQLOTU.id).where(
                    SQLOTU.id == otu_id,
                    compose_isolate_match(isolate_id),
                ),
            )
        ) is not None


async def get_legacy_otu_fields(
    pg: AsyncEngine,
    otu_id: str,
    fields: list[str],
    isolate_id: str | None = None,
) -> Document | None:
    """Return selected fields of an OTU document from Postgres, or ``None``.

    The Postgres counterpart of a projected ``mongo.otus.find_one``. The fields are read
    out of the ``data`` JSONB rather than from the promoted columns, so they reach the
    ones -- ``isolates``, ``schema`` -- the promotion does not carry, and only the
    requested fields cross the wire.

    ``None`` means the OTU has no row. A field the document does not carry is left out of
    the returned dict rather than returned as ``None``, because a Mongo projection omits
    it too and callers lean on that: ``evaluate_changes`` defaults a missing
    ``abbreviation`` to ``""`` with ``document.get("abbreviation", "")``, and a key
    present-and-``None`` would defeat that default and make an unchanged abbreviation
    read as an edit.

    When ``isolate_id`` is given the OTU must also carry that isolate, and ``None`` is
    returned if it does not.
    """
    filters = [SQLOTU.id == otu_id]

    if isolate_id is not None:
        filters.append(compose_isolate_match(isolate_id))

    async with AsyncSession(pg) as session:
        row = (
            await session.execute(
                select(
                    *[
                        SQLOTU.data[field].label(f"value_{index}")
                        for index, field in enumerate(fields)
                    ],
                    *[
                        SQLOTU.data.has_key(field).label(f"present_{index}")
                        for index, field in enumerate(fields)
                    ],
                ).where(*filters),
            )
        ).first()

    if row is None:
        return None

    values = row[: len(fields)]
    present = row[len(fields) :]

    return {
        field: value
        for field, value, is_present in zip(fields, values, present, strict=True)
        if is_present
    }


async def get_legacy_sequence(
    pg: AsyncEngine,
    otu_id: str,
    isolate_id: str,
    sequence_id: str,
) -> Document | None:
    """Fetch one sequence document from Postgres, scoped to its OTU and isolate.

    The Postgres counterpart of the ``mongo.sequences.find_one`` single-sequence read.
    Returns ``None`` when no sequence with that id belongs to the given OTU and isolate,
    exactly as the Mongo query matches nothing when any of the three ids disagree. The
    ``otu_id`` and ``isolate_id`` filters run on the promoted, indexed columns rather
    than casting them out of the ``data`` JSONB; the document itself is recovered
    verbatim from that column via :func:`sequence_document_from_row`.
    """
    async with AsyncSession(pg) as session:
        row = await session.scalar(
            select(SQLSequence).where(
                SQLSequence.id == sequence_id,
                SQLSequence.otu_id == otu_id,
                SQLSequence.isolate_id == isolate_id,
            ),
        )

    return sequence_document_from_row(row) if row is not None else None


async def list_legacy_isolate_sequences(
    pg: AsyncEngine,
    otu_id: str,
    isolate_id: str,
) -> list[Document]:
    """List an isolate's sequence documents from Postgres in Mongo natural order.

    The Postgres counterpart of ``mongo.sequences.find({"otu_id": ..., "isolate_id":
    ...})``. The rows are ordered by ``position`` so they arrive in the order Mongo's
    unsorted cursor returns them, and the filters run on the indexed ``otu_id`` and
    ``isolate_id`` columns. Each document is recovered verbatim from the ``data`` JSONB
    column.
    """
    async with AsyncSession(pg) as session:
        rows = await session.scalars(
            select(SQLSequence)
            .where(
                SQLSequence.otu_id == otu_id,
                SQLSequence.isolate_id == isolate_id,
            )
            .order_by(SQLSequence.position),
        )

        return [sequence_document_from_row(row) for row in rows]


async def legacy_sequence_exists(pg: AsyncEngine, sequence_id: str) -> bool:
    """Return whether a ``legacy_sequences`` row exists, without reading its ``data``.

    Backs the existence guards on the sequence update and delete handlers. Only the
    ``id`` column is selected so the check never de-TOASTs the large ``sequence`` body
    it does not need.
    """
    async with AsyncSession(pg) as session:
        return (
            await session.scalar(
                select(SQLSequence.id).where(SQLSequence.id == sequence_id),
            )
        ) is not None


async def list_legacy_otu_sequence_bodies(
    pg: AsyncEngine,
    otu_id: str,
) -> list[tuple[str, str, str]]:
    """Return an OTU's sequences as ``(isolate_id, sequence_id, sequence)`` tuples.

    Ordered by ``position`` -- Mongo natural order -- so an OTU-wide read can be
    bucketed back into its isolates without losing the order a FASTA export presents
    them in. Only the sequence body is read out of the ``data`` JSONB; the metadata
    fields a FASTA export does not use are left in the column rather than pulled over
    the wire.
    """
    async with AsyncSession(pg) as session:
        result = await session.execute(
            select(
                SQLSequence.isolate_id,
                SQLSequence.id,
                SQLSequence.data["sequence"].astext,
            )
            .where(SQLSequence.otu_id == otu_id)
            .order_by(SQLSequence.position),
        )

    return [tuple(row) for row in result.all()]


async def list_legacy_isolate_sequence_bodies(
    pg: AsyncEngine,
    otu_id: str,
    isolate_id: str,
) -> list[tuple[str, str]]:
    """Return an isolate's sequences as ``(sequence_id, sequence)`` tuples.

    Ordered by ``position`` and filtered on the indexed ``otu_id`` and ``isolate_id``
    columns. Only the sequence body is read out of the ``data`` JSONB.
    """
    async with AsyncSession(pg) as session:
        result = await session.execute(
            select(SQLSequence.id, SQLSequence.data["sequence"].astext)
            .where(
                SQLSequence.otu_id == otu_id,
                SQLSequence.isolate_id == isolate_id,
            )
            .order_by(SQLSequence.position),
        )

    return [tuple(row) for row in result.all()]


async def get_legacy_sequence_body(
    pg: AsyncEngine,
    sequence_id: str,
) -> tuple[str, str, str] | None:
    """Return ``(otu_id, isolate_id, sequence)`` for one sequence, or ``None``.

    Backs the single-sequence FASTA export. ``otu_id`` and ``isolate_id`` come from the
    promoted columns and only the sequence body is read out of the ``data`` JSONB, so
    the small metadata fields the export does not use are never pulled over the wire.
    """
    async with AsyncSession(pg) as session:
        row = (
            await session.execute(
                select(
                    SQLSequence.otu_id,
                    SQLSequence.isolate_id,
                    SQLSequence.data["sequence"].astext,
                ).where(SQLSequence.id == sequence_id),
            )
        ).first()

    return tuple(row) if row is not None else None


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
        "last_indexed_version": document["last_indexed_version"],
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

_OTU_ROW_CHUNK_SIZE = _MAX_BIND_PARAMETERS // 8
"""Max ``legacy_otus`` rows per statement.

Each row binds the eight columns produced by :func:`otu_row_values`.
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
    pg: AsyncEngine,
    otu_id: str,
    data: dict,
) -> str | None:
    """Check that the segment field is compatible with the parent OTU.

    Returns an error message string if the segment provided in `data` is not defined in
    the parent OTU's schema.

    Returns `None` if the check passes.

    :param pg: the application PostgreSQL engine
    :param otu_id: the ID of the parent OTU
    :param data: the data dict containing a segment value
    :return: message or `None` if check passes

    """
    segment = data.get("segment")

    if segment:
        otu = await get_legacy_otu_fields(pg, otu_id, ["schema"])
        schema = (otu or {}).get("schema") or []

        if segment not in {s["name"] for s in schema}:
            return f"Segment {segment} is not defined for the parent OTU"

    return None
