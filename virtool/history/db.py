"""Work with OTU history in the database."""

import math
from copy import deepcopy
from dataclasses import dataclass
from typing import TYPE_CHECKING

import dictdiffer
from sqlalchemy import Integer, cast, func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

import virtool.otus.db
import virtool.utils
from virtool.data.topg import (
    compose_legacy_id_multi_expression,
    compose_legacy_id_subquery,
    resolve_legacy_id,
)
from virtool.data.transforms import apply_transforms
from virtool.history.sql import SQLLegacyHistory, SQLLegacyHistoryDiff
from virtool.history.utils import (
    calculate_diff,
    compose_history_description,
    derive_otu_information,
)
from virtool.models.enums import HistoryMethod
from virtool.references.sql import SQLReference
from virtool.references.transforms import AttachReferenceTransform
from virtool.types import Document
from virtool.users.pg import SQLUser
from virtool.utils import base_processor

if TYPE_CHECKING:
    from virtool.mongo.core import Mongo

_HISTORY_DIFF_CHUNK_SIZE = 32767 // 3
"""Max ``legacy_history_diff`` rows per statement.

asyncpg caps bind parameters per statement at 32767. Each row binds three
(``change_id``, ``history_id``, and ``diff``).
"""

_LEGACY_HISTORY_CHUNK_SIZE = 32767 // 11
"""Max ``legacy_history`` rows per statement.

asyncpg caps bind parameters per statement at 32767. Each row binds eleven
columns: the ten from :func:`legacy_history_values` plus the resolved
``reference_id``.
"""


def legacy_history_values(document: Document) -> dict:
    """Map a history change ``document`` to ``legacy_history`` column values.

    Applies the sentinel-to-NULL conventions: an ``otu.version`` of ``"removed"``
    and an ``index`` of ``"unbuilt"`` are stored as ``NULL``.
    """
    otu_version = document["otu"]["version"]
    index_document = document["index"]

    return {
        "legacy_id": document["_id"],
        "created_at": document["created_at"],
        "description": document["description"],
        "method_name": document["method_name"],
        "user_id": document["user"]["id"],
        "otu": document["otu"]["id"],
        "otu_name": document["otu"]["name"],
        "otu_version": None if otu_version == "removed" else str(otu_version),
        "index": None if index_document["id"] == "unbuilt" else index_document["id"],
        "index_version": (
            None
            if index_document["version"] == "unbuilt"
            else str(index_document["version"])
        ),
    }


async def bulk_insert_diffs(pg: AsyncEngine, rows: list[dict]) -> None:
    """Insert ``rows`` into ``legacy_history_diff`` in asyncpg-safe chunks.

    Each row's ``history_id`` foreign key is resolved from the ``legacy_history``
    row whose ``legacy_id`` matches the row's ``change_id``. A ``change_id`` with no
    matching ``legacy_history`` row raises, mirroring the foreign key constraint.
    """
    if not rows:
        return

    change_ids = [row["change_id"] for row in rows]

    async with AsyncSession(pg) as session:
        history_ids: dict[str, int] = {}

        for start in range(0, len(change_ids), _LEGACY_HISTORY_CHUNK_SIZE):
            chunk = change_ids[start : start + _LEGACY_HISTORY_CHUNK_SIZE]
            result = await session.execute(
                select(SQLLegacyHistory.id, SQLLegacyHistory.legacy_id).where(
                    compose_legacy_id_multi_expression(SQLLegacyHistory, chunk),
                ),
            )

            for id_, legacy_id in result.all():
                history_ids[legacy_id] = id_

        missing = [
            change_id for change_id in change_ids if change_id not in history_ids
        ]

        if missing:
            raise ValueError(
                f"No legacy_history rows for changes: {', '.join(missing)}",
            )

        values = [{**row, "history_id": history_ids[row["change_id"]]} for row in rows]

        for start in range(0, len(values), _HISTORY_DIFF_CHUNK_SIZE):
            await session.execute(
                insert(SQLLegacyHistoryDiff).values(
                    values[start : start + _HISTORY_DIFF_CHUNK_SIZE],
                ),
            )

        await session.commit()


async def bulk_insert_history(
    pg_session: AsyncSession,
    diff_rows: list[dict],
    documents: list[Document],
) -> None:
    """Insert ``history_diffs`` and ``legacy_history`` rows into ``pg_session``.

    ``diff_rows`` and ``documents`` are parallel: ``diff_rows[i]`` must describe
    the same change as ``documents[i]``. They are validated to be aligned by
    ``change_id`` before any write, so a misaligned caller fails loudly rather
    than corrupting history.

    Both tables are written in asyncpg-safe chunks into the caller-provided
    ``pg_session`` without committing, so they commit or roll back together with the
    caller's surrounding transaction.
    """
    if {row["change_id"] for row in diff_rows} != {
        document["_id"] for document in documents
    }:
        raise ValueError(
            "diff_rows and documents must describe the same history changes",
        )

    if not documents:
        return

    legacy_rows = [legacy_history_values(document) for document in documents]

    embedded_reference_ids = {document["reference"]["id"] for document in documents}

    rows = (
        (
            await pg_session.execute(
                select(SQLReference.id, SQLReference.legacy_id).where(
                    compose_legacy_id_multi_expression(
                        SQLReference,
                        embedded_reference_ids,
                    ),
                ),
            )
        ).all()
        if embedded_reference_ids
        else []
    )

    reference_id_map: dict[int | str, int] = {
        **{id_: id_ for id_, _ in rows},
        **{legacy_id: id_ for id_, legacy_id in rows if legacy_id is not None},
    }

    unresolved = embedded_reference_ids - reference_id_map.keys()

    if unresolved:
        raise ValueError(
            f"References not found in postgres: {sorted(unresolved, key=str)}",
        )

    for row, document in zip(legacy_rows, documents, strict=True):
        row["reference_id"] = reference_id_map[document["reference"]["id"]]

    history_ids: dict[str, int] = {}

    for start in range(0, len(legacy_rows), _LEGACY_HISTORY_CHUNK_SIZE):
        result = await pg_session.execute(
            insert(SQLLegacyHistory)
            .values(legacy_rows[start : start + _LEGACY_HISTORY_CHUNK_SIZE])
            .returning(SQLLegacyHistory.id, SQLLegacyHistory.legacy_id),
        )

        for id_, legacy_id in result.all():
            history_ids[legacy_id] = id_

    diff_values = [
        {**row, "history_id": history_ids[row["change_id"]]} for row in diff_rows
    ]

    for start in range(0, len(diff_values), _HISTORY_DIFF_CHUNK_SIZE):
        await pg_session.execute(
            insert(SQLLegacyHistoryDiff).values(
                diff_values[start : start + _HISTORY_DIFF_CHUNK_SIZE],
            ),
        )


@dataclass
class PreparedChange:
    diff: dict
    document: Document
    id: str


async def add(
    pg_session: AsyncSession,
    description: str,
    method_name: HistoryMethod,
    old: dict | None,
    new: dict | None,
    user_id: int,
) -> dict:
    """Add a change document to ``legacy_history``.

    Writes into the caller-provided ``pg_session`` and does not commit, so the history
    rows land or roll back atomically with the surrounding transaction (e.g. the paired
    Mongo write coordinated by ``both_transactions``). The session is flushed to populate
    the ``legacy_history`` primary key for the diff's foreign key.

    :param pg_session: an active Postgres session owned by the caller
    :param method_name: the name of the handler method that executed the change
    :param old: the otu document prior to the change
    :param new: the otu document after the change
    :param description: a human-readable description of the change
    :param user_id: the id of the requesting user
    :return: the change document

    """
    prepared = prepare_add(method_name, old, new, user_id, description=description)

    document = prepared.document

    diff_row = SQLLegacyHistoryDiff(change_id=document["_id"], diff=prepared.diff)
    legacy_row = SQLLegacyHistory(**legacy_history_values(document))

    reference_id = document["reference"]["id"]

    legacy_row.reference_id = await resolve_legacy_id(
        pg_session,
        SQLReference,
        reference_id,
    )

    if legacy_row.reference_id is None:
        raise ValueError(f"Reference {reference_id!r} not found in postgres")

    pg_session.add(legacy_row)
    await pg_session.flush()
    diff_row.history_id = legacy_row.id
    pg_session.add(diff_row)

    return {**document, "diff": prepared.diff}


def prepare_add(
    method_name: HistoryMethod,
    old: dict | None,
    new: dict | None,
    user_id: int,
    description: str = "",
) -> PreparedChange:
    """Add a change document to ``legacy_history``.

    :param method_name: the name of the method that executed the change
    :param old: the otu document prior to the change
    :param new: the otu document after the change
    :param user_id: the id of the requesting user
    :return: the change document

    """
    otu_id, otu_name, otu_version, ref_id = derive_otu_information(old, new)

    try:
        abbreviation = new["abbreviation"]
    except (TypeError, KeyError):
        abbreviation = old["abbreviation"]

    if not description:
        description = compose_history_description(method_name, otu_name, abbreviation)

    if method_name.value == "create":
        diff = new

    elif method_name.value == "remove":
        diff = old

    else:
        diff = calculate_diff(old, new)

    change_id = f"{otu_id}.{otu_version}"

    return PreparedChange(
        diff,
        {
            "_id": change_id,
            "created_at": virtool.utils.timestamp(),
            "description": description,
            "diff": "postgres",
            "index": {"id": "unbuilt", "version": "unbuilt"},
            "method_name": method_name.value,
            "otu": {"id": otu_id, "name": otu_name, "version": otu_version},
            "reference": {"id": ref_id},
            "user": {"id": user_id},
        },
        change_id,
    )


def coerce_otu_version(otu_version: str | None) -> int | str:
    """Reverse the ``legacy_history.otu_version`` sentinel-to-NULL convention.

    A ``NULL`` ``otu_version`` becomes the ``"removed"`` sentinel and a stringified
    numeric version is coerced back to an ``int`` so the reconstructed value matches
    the historical Mongo representation.
    """
    if otu_version is None:
        return "removed"

    return int(otu_version) if otu_version.isdigit() else otu_version


def legacy_history_document(row: SQLLegacyHistory, handle: str) -> Document:
    """Reconstruct a history list document from a ``legacy_history`` row.

    Reverses the sentinel-to-NULL conventions applied by :func:`legacy_history_values`:
    a ``NULL`` ``otu_version`` becomes the ``"removed"`` sentinel and a ``NULL`` ``index``
    becomes the ``"unbuilt"`` sentinel. Stringified numeric versions are coerced back to
    integers so the resource shape matches the historical Mongo representation.

    The ``handle`` comes from a join on ``users`` so the nested user is fully populated
    without a follow-up transform.
    """
    otu_version = coerce_otu_version(row.otu_version)

    if row.index is None:
        index = {"id": "unbuilt", "version": "unbuilt"}
    else:
        index_version = row.index_version

        if index_version is not None and index_version.isdigit():
            index_version = int(index_version)

        index = {"id": row.index, "version": index_version}

    return {
        "_id": row.legacy_id,
        "created_at": row.created_at,
        "description": row.description,
        "method_name": row.method_name,
        "otu": {"id": row.otu, "name": row.otu_name, "version": otu_version},
        "reference": {"id": row.reference_id},
        "index": index,
        "user": {"id": row.user_id, "handle": handle},
    }


async def find(
    mongo: "Mongo",
    pg: AsyncEngine,
    page: int,
    per_page: int,
    reference_id: int | str | None = None,
    unbuilt: bool | None = None,
) -> dict:
    """List history changes from the ``legacy_history`` table.

    Changes are sorted by ``otu_version`` descending with a deterministic ``id``
    tiebreaker so pagination is stable. ``reference_id`` scopes both the returned page
    and the ``total_count``; ``unbuilt`` is a tri-state search filter on whether the
    change is included in a built index (``index`` is ``NULL`` when unbuilt).

    :param mongo: the application database client, used to attach reference data
    :param pg: the application PostgreSQL database object
    :param page: the one-indexed page number to return
    :param per_page: the number of documents to return per page
    :param reference_id: restrict changes to a single reference
    :param unbuilt: ``True`` for unbuilt changes only, ``False`` for built changes only
    :return: a search result including the matched change documents
    """
    base_filters = []

    if reference_id is not None:
        base_filters.append(
            SQLLegacyHistory.reference_id
            == compose_legacy_id_subquery(SQLReference, reference_id),
        )

    search_filters = list(base_filters)

    if unbuilt is True:
        search_filters.append(SQLLegacyHistory.index.is_(None))
    elif unbuilt is False:
        search_filters.append(SQLLegacyHistory.index.isnot(None))

    async with AsyncSession(pg) as session:
        total_count = await session.scalar(
            select(func.count()).select_from(SQLLegacyHistory).where(*base_filters),
        )

        found_count = await session.scalar(
            select(func.count()).select_from(SQLLegacyHistory).where(*search_filters),
        )

        rows = (
            await session.execute(
                select(SQLLegacyHistory, SQLUser.handle)
                .join(SQLUser, SQLLegacyHistory.user_id == SQLUser.id)
                .where(*search_filters)
                .order_by(
                    cast(SQLLegacyHistory.otu_version, Integer).desc().nulls_first(),
                    SQLLegacyHistory.id.desc(),
                )
                .offset(per_page * (page - 1))
                .limit(per_page),
            )
        ).all()

    documents = await apply_transforms(
        [base_processor(legacy_history_document(row, handle)) for row, handle in rows],
        [AttachReferenceTransform(pg)],
        pg,
    )

    return {
        "documents": documents,
        "total_count": total_count,
        "found_count": found_count,
        "page_count": math.ceil(found_count / per_page),
        "per_page": per_page,
        "page": page,
    }


async def find_by_index(
    mongo: "Mongo",
    pg: AsyncEngine,
    index_id: str,
    page: int,
    per_page: int,
    term: str | None = None,
) -> dict:
    """List the history changes included in a single index build.

    Changes are read from the ``legacy_history`` table, filtered to ``index_id`` and
    optionally a search ``term`` matched against the OTU name. They are sorted by OTU
    name ascending then OTU version descending, mirroring the legacy Mongo query.

    The legacy Mongo query also matched ``term`` against ``user.id``, but that field is
    now an integer foreign key and never matched the case-insensitive regex, so only the
    OTU name is searched here.

    ``total_count`` reflects every change in the table, mirroring the unscoped
    ``base_query`` the previous Mongo implementation passed to ``paginate``.

    :param mongo: the application database client, used to attach reference data
    :param pg: the application PostgreSQL database object
    :param index_id: restrict changes to a single index build
    :param page: the one-indexed page number to return
    :param per_page: the number of documents to return per page
    :param term: an optional term matched against the OTU name
    :return: a search result including the matched change documents
    """
    search_filters = [SQLLegacyHistory.index == index_id]

    if term:
        search_filters.append(
            SQLLegacyHistory.otu_name.icontains(term, autoescape=True)
        )

    async with AsyncSession(pg) as session:
        total_count = await session.scalar(
            select(func.count()).select_from(SQLLegacyHistory),
        )

        found_count = await session.scalar(
            select(func.count()).select_from(SQLLegacyHistory).where(*search_filters),
        )

        rows = (
            await session.execute(
                select(SQLLegacyHistory, SQLUser.handle)
                .join(SQLUser, SQLLegacyHistory.user_id == SQLUser.id)
                .where(*search_filters)
                .order_by(
                    SQLLegacyHistory.otu_name.asc(),
                    cast(SQLLegacyHistory.otu_version, Integer).desc().nulls_last(),
                )
                .offset(per_page * (page - 1))
                .limit(per_page),
            )
        ).all()

    documents = await apply_transforms(
        [base_processor(legacy_history_document(row, handle)) for row, handle in rows],
        [AttachReferenceTransform(pg)],
        pg,
    )

    return {
        "documents": documents,
        "total_count": total_count,
        "found_count": found_count,
        "page_count": math.ceil(found_count / per_page),
        "per_page": per_page,
        "page": page,
    }


async def get_contributors(
    pg: AsyncEngine,
    reference_id: int | str | None = None,
    index_id: str | None = None,
) -> list[dict]:
    """Return a list of contributors and their contribution count for a set of history.

    The set is scoped by ``reference_id`` or ``index_id``. Contribution counts are
    aggregated in Postgres by ``user_id`` and joined to user handles. A change whose
    user cannot be resolved is reported as the ``"Unknown User"`` fallback.

    :param pg: the application PostgreSQL database object
    :param reference_id: restrict contributions to a single reference
    :param index_id: restrict contributions to a single built index
    :return: a list of contributors to the scanned history changes
    :raises ValueError: if neither ``reference_id`` nor ``index_id`` is provided
    """
    if reference_id is None and index_id is None:
        raise ValueError("get_contributors requires a reference_id or index_id")

    filters = []

    if reference_id is not None:
        filters.append(
            SQLLegacyHistory.reference_id
            == compose_legacy_id_subquery(SQLReference, reference_id),
        )

    if index_id is not None:
        filters.append(SQLLegacyHistory.index == index_id)

    async with AsyncSession(pg) as session:
        counts = (
            await session.execute(
                select(SQLLegacyHistory.user_id, func.count())
                .where(*filters)
                .group_by(SQLLegacyHistory.user_id)
                .order_by(SQLLegacyHistory.user_id),
            )
        ).all()

        if not counts:
            return []

        users = {
            row.id: {"id": row.id, "handle": row.handle}
            for row in (
                await session.execute(
                    select(SQLUser.id, SQLUser.handle).where(
                        SQLUser.id.in_([user_id for user_id, _ in counts]),
                    ),
                )
            ).all()
        }

    return [
        {**users.get(user_id, {"id": -1, "handle": "Unknown User"}), "count": count}
        for user_id, count in counts
    ]


async def get_most_recent_change(pg: AsyncEngine, otu_id: str) -> Document | None:
    """Get the most recent change for the otu identified by the passed ``otu_id``.

    Reads from the ``legacy_history`` table, returning the change with the highest
    ``otu_version``. A ``NULL`` ``otu_version`` marks a ``"removed"`` change and sorts
    first, matching the descending Mongo sort it replaces. The returned document
    mirrors the historical Mongo projection so callers can attach user data and format
    it unchanged.

    :param pg: the application PostgreSQL database object
    :param otu_id: the target otu_id
    :return: the most recent change document, or ``None`` if the otu has no history

    """
    async with AsyncSession(pg) as session:
        row = (
            await session.execute(
                select(SQLLegacyHistory)
                .where(SQLLegacyHistory.otu == otu_id)
                .order_by(
                    cast(SQLLegacyHistory.otu_version, Integer).desc().nulls_first(),
                    SQLLegacyHistory.id.desc(),
                )
                .limit(1),
            )
        ).scalar_one_or_none()

    if row is None:
        return None

    return {
        "_id": row.legacy_id,
        "created_at": row.created_at,
        "description": row.description,
        "method_name": row.method_name,
        "user": {"id": row.user_id},
        "otu": {
            "id": row.otu,
            "name": row.otu_name,
            "version": coerce_otu_version(row.otu_version),
        },
    }


def _stamp_reference(otu: Document, reference_id: int | str) -> None:
    """Overwrite the embedded ``reference.id`` on a joined OTU and all of its sequences.

    A joined OTU reconstructed from a diff carries whatever ``reference.id`` was stored
    in that historical snapshot, which may be a stale legacy string. Because an OTU's
    parent reference never changes, the authoritative id is restamped here so patched
    OTUs and their sequences carry the current (integer) reference.
    """
    otu["reference"] = {"id": reference_id}

    for isolate in otu.get("isolates", []):
        for sequence in isolate.get("sequences", []):
            sequence["reference"] = {"id": reference_id}


def _change_to_revert(row: SQLLegacyHistory) -> Document:
    """Build the minimal change document that :func:`patch_to_version` reverts.

    The shape mirrors the fields the revert loop and :func:`_resolve_diffs` read from a
    history change document: ``_id``, the ``"postgres"`` diff sentinel, ``method_name``,
    and the coerced ``otu.version``. Keeping this construction in one place stops it from
    silently drifting from what :func:`_resolve_diffs` expects.
    """
    return {
        "_id": row.legacy_id,
        "diff": "postgres",
        "method_name": row.method_name,
        "otu": {"version": coerce_otu_version(row.otu_version)},
    }


async def _resolve_diffs(pg: AsyncEngine, changes: list[Document]) -> dict[str, object]:
    """Resolve the ``diff`` for each change, fetching Postgres-stored diffs in one query.

    Every change stores the sentinel string ``"postgres"`` in Mongo and the real diff
    in ``SQLLegacyHistoryDiff``. A change whose ``diff`` is anything else is an unbackfilled
    legacy inline diff and raises ``ValueError``.

    :param pg: the application PostgreSQL database object
    :param changes: the change documents to resolve diffs for
    :return: a mapping of change id to resolved diff
    :raises ValueError: if a change holds an inline diff instead of the ``"postgres"``
        sentinel

    """
    resolved: dict[str, object] = {}
    postgres_change_ids = []

    for change in changes:
        if change["diff"] != "postgres":
            raise ValueError(
                f"Unexpected inline diff for change {change['_id']}; "
                "expected 'postgres' sentinel",
            )

        postgres_change_ids.append(change["_id"])

    if postgres_change_ids:
        async with AsyncSession(pg) as session:
            result = await session.execute(
                select(SQLLegacyHistory.legacy_id, SQLLegacyHistoryDiff.diff)
                .join(
                    SQLLegacyHistoryDiff,
                    SQLLegacyHistoryDiff.history_id == SQLLegacyHistory.id,
                )
                .where(
                    compose_legacy_id_multi_expression(
                        SQLLegacyHistory,
                        postgres_change_ids,
                    ),
                ),
            )

            for legacy_id, diff in result.all():
                resolved[legacy_id] = diff

        missing = [
            change_id for change_id in postgres_change_ids if change_id not in resolved
        ]

        if missing:
            raise ValueError(
                f"Missing legacy_history_diff rows for changes: {', '.join(missing)}",
            )

    return resolved


async def patch_to_version(
    mongo: "Mongo",
    pg: AsyncEngine,
    otu_id: str,
    version: str | int,
) -> tuple:
    """Take a joined otu back in time to the passed ``version``.

    Uses the diffs in the change documents associated with the otu.

    :param mongo: the database object
    :param pg: the application PostgreSQL database object
    :param otu_id: the id of the otu to patch
    :param version: the version to patch to
    :return: the current joined otu and the patched otu

    """
    current = await virtool.otus.db.join(mongo, otu_id) or {}

    if "version" in current and current["version"] == version:
        return current, deepcopy(current)

    patched = deepcopy(current)

    # Collect the changes to revert, sorted by descending version. Stream the ordered
    # rows and stop at the first change at or below the target version, preserving the
    # early break of the legacy Mongo cursor so a heavily-edited otu never loads its
    # whole history.
    changes_to_revert = []
    reference_id_from_history: int | str | None = None

    async with AsyncSession(pg) as session:
        result = await session.stream_scalars(
            select(SQLLegacyHistory)
            .where(SQLLegacyHistory.otu == otu_id)
            .order_by(
                cast(SQLLegacyHistory.otu_version, Integer).desc().nulls_first(),
                SQLLegacyHistory.id.desc(),
            ),
        )

        async for row in result:
            if reference_id_from_history is None:
                reference_id_from_history = row.reference_id or row.reference

            otu_version = coerce_otu_version(row.otu_version)

            if otu_version == "removed" or otu_version > version:
                changes_to_revert.append(_change_to_revert(row))
            else:
                break

    diffs = await _resolve_diffs(pg, changes_to_revert)

    for change in changes_to_revert:
        diff = diffs[change["_id"]]

        if change["method_name"] == "remove":
            patched = diff

        elif change["method_name"] == "create":
            patched = None

        else:
            patched = dictdiffer.patch(dictdiffer.swap(diff), patched)

    if patched:
        # An OTU's parent reference is immutable, so the authoritative id is the live
        # OTU's when it still exists, falling back to the history rows for an OTU that
        # was removed and no longer has a live document.
        reference_id = (
            current["reference"]["id"] if current else reference_id_from_history
        )

        _stamp_reference(patched, reference_id)

    if current == {}:
        current = None

    return current, patched
