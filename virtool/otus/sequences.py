"""
Database functions and utilities for sequences.

"""
from typing import Optional, Union, Dict, Any

import virtool.db.utils
import virtool.history
import virtool.history.db
import virtool.otus
import virtool.otus.db
import virtool.otus.utils
import virtool.utils
from virtool.types import App


async def check_segment_or_target(
        db,
        otu_id: str,
        isolate_id: str,
        sequence_id: Optional[str],
        ref_id: str,
        data: dict
) -> Optional[str]:
    """
    Returns an error message string if the segment or target provided in `data` is not compatible with the parent
    reference (target) or OTU (segment).

    Returns `None` if the check passes.

    :param db: the application database object
    :param otu_id: the ID of the parent OTU
    :param isolate_id: the ID of the parent isolate
    :param sequence_id: the ID of the sequence if one is being edited
    :param ref_id: the ID of the parent reference
    :param data: the data dict containing a target or segment value
    :return: message or `None` if check passes

    """
    reference = await db.references.find_one(ref_id, ["data_type", "targets"])

    if reference["data_type"] == "barcode":
        target = data.get("target")

        if sequence_id is None and target is None:
            return "The 'target' field is required for barcode references"

        if target:
            if target not in {t["name"] for t in reference.get("targets", [])}:
                return f"Target {target} is not defined for the parent reference"

            used_targets_query = {
                "otu_id": otu_id,
                "isolate_id": isolate_id
            }

            if sequence_id:
                used_targets_query["_id"] = {
                    "$ne": sequence_id
                }

            used_targets = await db.sequences.distinct("target", used_targets_query)

            if target in used_targets:
                return f"Target {target} is already used in isolate {isolate_id}"

    if reference["data_type"] == "genome" and data.get("segment"):
        schema = await virtool.db.utils.get_one_field(db.otus, "schema", otu_id) or list()

        segment = data.get("segment")

        if segment not in {s["name"] for s in schema}:
            return f"Segment {segment} is not defined for the parent OTU"

    return None


async def create(
        app: App,
        ref_id: str,
        otu_id: str,
        isolate_id: str,
        data: dict,
        user_id: str,
        sequence_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Create a new sequence document. Update the

    :param app: the application object
    :param ref_id: the ID of the parent reference
    :param otu_id: the ID of the parent OTU
    :param isolate_id: the ID of the parent isolate
    :param data: source data for the new sequence
    :param user_id: the ID of the requesting user
    :param sequence_id: optionally force a sequence ID
    :return: the new sequence

    """
    db = app["db"]

    segment = data.get("segment")

    # Update POST data to make sequence document.
    to_insert = {
        **data,
        "otu_id": otu_id,
        "isolate_id": isolate_id,
        "host": data.get("host", ""),
        "reference": {
            "id": ref_id
        },
        "segment": segment,
        "sequence": data["sequence"].replace(" ", "").replace("\n", "")
    }

    old = await virtool.otus.db.join(db, otu_id)

    if sequence_id:
        to_insert["_id"] = sequence_id

    sequence_document = await db.sequences.insert_one(to_insert)

    document = await increment_otu_version(db, otu_id)

    new = await virtool.otus.db.join(db, otu_id, document)

    await virtool.otus.db.update_verification(db, new)

    isolate = virtool.otus.utils.find_isolate(old["isolates"], isolate_id)

    await virtool.history.db.add(
        app,
        "create_sequence",
        old,
        new,
        f"Created new sequence {data['accession']} in {virtool.otus.utils.format_isolate_name(isolate)}",
        user_id
    )

    return virtool.utils.base_processor(sequence_document)


async def edit(app, otu_id: str, isolate_id: str, sequence_id: str, data: dict, user_id: str) -> dict:
    """
    Edit an existing sequence identified by its `otu_id`, `isolate_id`, and `sequence_id` using the passed update
    `data`.

    :param app: the application object
    :param otu_id: the ID of the parent OTU:
    :param isolate_id: the ID of the parent isolate
    :param sequence_id: the ID of the sequence to edit
    :param data: the update to apply to the sequence
    :param user_id: the ID of the requesting user
    :return: the updated sequence document

    """
    db = app["db"]

    update = dict(data)

    if "sequence" in update:
        update["sequence"] = data["sequence"].replace(" ", "").replace("\n", "")

    old = await virtool.otus.db.join(db, otu_id)

    sequence_document = await db.sequences.find_one_and_update({"_id": sequence_id}, {
        "$set": update
    })

    document = await increment_otu_version(db, otu_id)

    new = await virtool.otus.db.join(db, otu_id, document)

    await virtool.otus.db.update_verification(db, new)

    isolate = virtool.otus.utils.find_isolate(old["isolates"], isolate_id)

    isolate_name = virtool.otus.utils.format_isolate_name(isolate)

    await virtool.history.db.add(
        app,
        "edit_sequence",
        old,
        new,
        f"Edited sequence {sequence_id} in {isolate_name}",
        user_id
    )

    return virtool.utils.base_processor(sequence_document)


async def get(db, otu_id: str, isolate_id: str, sequence_id: str) -> Optional[dict]:
    """
    Get a sequence document given a `otu_id`, `isolate_id`, and `sequence_id`. Returns `None` if the OTU, isolate, or
    sequence do not exist.

    :param db:
    :param otu_id: the ID of the parent OTU:
    :param isolate_id: the ID of the parent isolate
    :param sequence_id: the ID of the sequence to get
    :return: the sequence document

    """
    if not await db.otus.count_documents({"_id": otu_id, "isolates.id": isolate_id}):
        return None

    query = {
        "_id": sequence_id,
        "otu_id": otu_id,
        "isolate_id": isolate_id
    }

    document = await db.sequences.find_one(query, virtool.otus.db.SEQUENCE_PROJECTION)

    if not document:
        return None

    return virtool.utils.base_processor(document)


async def increment_otu_version(db, otu_id: str) -> dict:
    """
    Increment the `version` field by one for the OTU identified by `otu_id`.

    :param db: the application database client
    :param otu_id: the ID of the OTU whose version should be increased
    :return: the updated OTU document

    """
    return await db.otus.find_one_and_update({"_id": otu_id}, {
        "$set": {
            "verified": False
        },
        "$inc": {
            "version": 1
        }
    })


async def remove(app, otu_id: str, isolate_id: str, sequence_id: str, user_id: str):
    """
    Remove the sequence identified by the passed `sequence_id`.

    :param app: the application object
    :param otu_id: the ID of the parent OTU:
    :param isolate_id: the ID of the parent isolate
    :param sequence_id: the ID of the sequence to remove
    :param user_id: the ID of the requesting user

    """
    db = app["db"]

    old = await virtool.otus.db.join(db, otu_id)

    isolate = virtool.otus.utils.find_isolate(old["isolates"], isolate_id)

    await db.sequences.delete_one({"_id": sequence_id})

    document = await increment_otu_version(db, otu_id)

    new = await virtool.otus.db.join(db, otu_id, document)

    await virtool.otus.db.update_verification(db, new)

    isolate_name = virtool.otus.utils.format_isolate_name(isolate)

    await virtool.history.db.add(
        app,
        "remove_sequence",
        old,
        new,
        f"Removed sequence {sequence_id} from {isolate_name}",
        user_id
    )
