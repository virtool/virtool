"""Work with OTUs in the database."""

from typing import Any

from motor.motor_asyncio import AsyncIOMotorClientSession
from sqlalchemy import distinct, func, select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

import virtool.history.db
import virtool.otus.utils
from virtool.api.utils import compose_regex_query, paginate
from virtool.data.topg import (
    compose_legacy_id_mongo_match,
    compose_legacy_id_subquery,
)
from virtool.data.transforms import apply_transforms
from virtool.errors import DatabaseError
from virtool.history.sql import SQLLegacyHistory
from virtool.mongo.core import Mongo
from virtool.mongo.utils import get_one_field
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
        [AttachReferenceTransform(mongo)],
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


async def bulk_join_query(
    mongo: "Mongo",
    query: dict,
    session: AsyncIOMotorClientSession | None = None,
) -> list[dict[str, Any]]:
    """Join the otu associated with the supplied ``otu_id`` with its sequences.

    If an OTU is passed, the document will not be pulled from the database.

    :param mongo: the application database client
    :param query: mongo query for the target documents
    :param document: use this otu document as a basis for the join
    :param session: a Motor session to use for database operations
    :return: the joined otu document
    """
    cursor = mongo.otus.find(query, session=session)
    documents = [document async for document in cursor]

    return await bulk_join_documents(mongo, documents, session)


async def bulk_join_ids(
    mongo,
    ids: list[str],
    session: AsyncIOMotorClientSession | None = None,
) -> list[dict[str, Any]]:
    """Join the otu associated with the supplied ``otu_id`` with its sequences.

    If an OTU is passed, the document will not be pulled from the database.

    :param mongo: the application database client
    :param ids: the ids of the otus to join
    :param session: a Motor session to use for database operations
    :return: the joined otu document
    """
    cursor = mongo.otus.find({"_id": {"$in": ids}}, session=session)

    return await bulk_join_documents(
        mongo,
        [document async for document in cursor],
        session,
    )


async def bulk_join_documents(
    mongo,
    otus: list[Document],
    session: AsyncIOMotorClientSession | None = None,
) -> list[dict[str, Any]]:
    """Join the otu associated with the supplied ``otu_id`` with its sequences.

    If an OTU is passed, the document will not be pulled from the database.

    :param mongo: the application database client
    :param otus: use these otu documents as a basis for the joins
    :param session: a Motor session to use for database operations
    :return: the joined otu document
    """
    # Get the otu entry if a ``document`` parameter was not passed

    cursor = mongo.sequences.find(
        {"otu_id": {"$in": [otu["_id"] for otu in otus]}},
        session=session,
    )

    sequences = {}
    async for sequence in cursor:
        dict_entry = sequences.setdefault(sequence["otu_id"], [])
        dict_entry.append(sequence)

    merged_documents = [
        virtool.otus.utils.merge_otu(otu, sequences[otu["_id"]]) for otu in otus
    ]

    return merged_documents


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
