"""Work with OTUs in the database."""

from collections.abc import Mapping
from typing import Any

from motor.motor_asyncio import AsyncIOMotorClientSession

import virtool.history.db
import virtool.otus.utils
from virtool.api.utils import compose_regex_query, paginate
from virtool.data.transforms import apply_transforms
from virtool.errors import DatabaseError
from virtool.mongo.core import Mongo
from virtool.mongo.utils import get_one_field
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
    ref_id: str,
    name: str | None = None,
    abbreviation: str | None = None,
) -> str | None:
    """Check of an OTU name and abbreviation are already in use.

    Returns an error message if the ``name`` or ``abbreviation`` are already in use.

    :param mongo: the application database client
    :param ref_id: the id of the reference to check in
    :param name: an OTU name
    :param abbreviation: an OTU abbreviation

    """
    name_exists = name and await mongo.otus.count_documents(
        {"lower_name": name.lower(), "reference.id": ref_id},
        limit=1,
    )

    abbreviation_exists = abbreviation and await mongo.otus.count_documents(
        {"abbreviation": abbreviation, "reference.id": ref_id},
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
    term: str | None,
    req_query: Mapping,
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
        base_query = {"reference.id": ref_id}

    data = await paginate(
        mongo.otus,
        mongo_query,
        req_query,
        base_query=base_query,
        sort="name",
        projection=["_id", "abbreviation", "name", "reference", "verified", "version"],
    )

    data["documents"] = await apply_transforms(
        [base_processor(d) for d in data["documents"]],
        [AttachReferenceTransform(mongo)],
    )

    history_query = {"index.id": "unbuilt"}

    if ref_id:
        history_query["reference.id"] = ref_id

    data["modified_count"] = len(
        await mongo.history.distinct("otu.name", history_query),
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
    otu_id: str,
    joined: dict | None = None,
    issues: dict | bool | None = False,
) -> dict | None:
    """Join the otu identified by the passed ``otu_id``.

    Reuses the ``joined`` otu document if available to save a database query. Then,
    format the joined otu into a format that can be directly returned to API clients.

    :param mongo: the application database client
    :param otu_id: the id of the otu to join
    :param joined:
    :param issues: an object describing issues in the otu
    :return: a joined and formatted otu

    """
    joined = joined or await join(mongo, otu_id)

    if not joined:
        return None

    most_recent_change = await virtool.history.db.get_most_recent_change(mongo, otu_id)

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


async def check_sequence_segment_or_target(
    mongo: "Mongo",
    otu_id: str,
    isolate_id: str,
    sequence_id: str | None,
    ref_id: str,
    data: dict,
) -> str | None:
    """Check that segment or target field is compatible with the reference.

    Returns an error message string if the segment or target provided in `data` is not
    compatible with the parent reference (target) or OTU (segment).

    Returns `None` if the check passes.

    :param mongo: the application database object
    :param otu_id: the ID of the parent OTU
    :param isolate_id: the ID of the parent isolate
    :param sequence_id: the ID of the sequence if one is being edited
    :param ref_id: the ID of the parent reference
    :param data: the data dict containing a target or segment value
    :return: message or `None` if check passes

    """
    reference = await mongo.references.find_one(ref_id, ["data_type", "targets"])

    if reference["data_type"] == "barcode":
        target = data.get("target")

        if sequence_id is None and target is None:
            return "The 'target' field is required for barcode references"

        if target:
            if target not in {t["name"] for t in reference.get("targets", [])}:
                return f"Target {target} is not defined for the parent reference"

            used_targets_query = {"otu_id": otu_id, "isolate_id": isolate_id}

            if sequence_id:
                used_targets_query["_id"] = {"$ne": sequence_id}

            used_targets = await mongo.sequences.distinct("target", used_targets_query)

            if target in used_targets:
                return f"Target {target} is already used in isolate {isolate_id}"

    if reference["data_type"] == "genome" and data.get("segment"):
        schema = await get_one_field(mongo.otus, "schema", otu_id) or []

        segment = data.get("segment")

        if segment not in {s["name"] for s in schema}:
            return f"Segment {segment} is not defined for the parent OTU"
