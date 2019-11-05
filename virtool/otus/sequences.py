"""
Database functions and utilities for sequences.

"""
from typing import Union

import virtool.history
import virtool.history.db
import virtool.otus
import virtool.otus.db
import virtool.otus.utils
import virtool.utils


async def create(db, ref_id, otu_id, isolate_id, data, user_id):
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

    sequence_document = await db.sequences.insert_one(to_insert)

    document = await increment_otu_version(db, otu_id)

    new = await virtool.otus.db.join(db, otu_id, document)

    await virtool.otus.db.update_verification(db, new)

    isolate = virtool.otus.utils.find_isolate(old["isolates"], isolate_id)

    await virtool.history.db.add(
        db,
        "create_sequence",
        old,
        new,
        f"Created new sequence {data['accession']} in {virtool.otus.utils.format_isolate_name(isolate)}",
        user_id
    )

    return virtool.utils.base_processor(sequence_document)


async def edit(db, otu_id: str, isolate_id: str, sequence_id: str, data: dict, user_id: str) -> dict:
    """
    Edit an existing sequence identified by its `otu_id`, `isolate_id`, and `sequence_id`. Returns the updated sequence
    document.

    :param db:
    :param otu_id:
    :param isolate_id:
    :param sequence_id:
    :param data:
    :param user_id:
    :return: the updated sequence document

    """
    update = {
        **data,
        "sequence": data["sequence"].replace(" ", "").replace("\n", "")
    }

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
        db,
        "edit_sequence",
        old,
        new,
        f"Edited sequence {sequence_id} in {isolate_name}",
        user_id
    )

    return virtool.utils.base_processor(sequence_document)


async def get(db, otu_id: str, isolate_id: str, sequence_id: str) -> Union[dict, None]:
    """
    Get a sequence document given a `otu_id`, `isolate_id`, and `sequence_id`. Returns `None` if the OTU, isolate, or
    sequence do not exist.

    :param db:
    :param otu_id:
    :param isolate_id:
    :param sequence_id:
    :return: the sequence document

    """
    if not await db.otus.count({"_id": otu_id, "isolates.id": isolate_id}):
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


async def increment_otu_version(db, otu_id) -> dict:
    return await db.otus.find_one_and_update({"_id": otu_id}, {
        "$set": {
            "verified": False
        },
        "$inc": {
            "version": 1
        }
    })


async def remove(db, otu_id: str, isolate_id: str, sequence_id: str, user_id: str):
    """
    Remove the sequence identified by the passed `sequence_id`. The parent OTU will also be updated.

    :param db:
    :param otu_id:
    :param isolate_id:
    :param sequence_id:
    :param user_id:

    """
    old = await virtool.otus.db.join(db, otu_id)

    isolate = virtool.otus.utils.find_isolate(old["isolates"], isolate_id)

    await db.sequences.delete_one({"_id": sequence_id})

    document = await increment_otu_version(db, otu_id)

    new = await virtool.otus.db.join(db, otu_id, document)

    await virtool.otus.db.update_verification(db, new)

    isolate_name = virtool.otus.utils.format_isolate_name(isolate)

    await virtool.history.db.add(
        db,
        "remove_sequence",
        old,
        new,
        f"Removed sequence {sequence_id} from {isolate_name}",
        user_id
    )
