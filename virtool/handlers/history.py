import virtool.virus_history

import virtool.virus
from virtool.virus import join, extract_isolate_ids
from virtool.handlers.utils import unpack_json_request, json_response, not_found


async def find(req):
    """
    Get a list of change documents.
     
    """
    db = req.app["db"]

    documents = await db.history.find({}, virtool.virus_history.LIST_PROJECTION).to_list(length=15)

    return json_response([virtool.virus_history.processor(document) for document in documents])


async def get(req):
    """
    Get a specific change document by its ``change_id``.
     
    """
    db = req.app["db"]

    change_id = req.match_info["change_id"]

    document = await db.history.find_one(change_id, virtool.virus_history.PROJECTION)

    if not document:
        return not_found()

    return json_response(virtool.virus_history.processor(document))


async def revert(req):
    """
    Remove the change document with the given ``change_id`` and any subsequent changes.
     
    """
    db = req.app["db"]

    change_id = req.match_info["change_id"]

    if not await db.history.count({"_id": change_id}):
        return not_found()

    virus_id, virus_version = change_id.split(".")

    if virus_version != "removed":
        virus_version = int(virus_version)

    # Try to find the current document for the given virus_id. If it has been deleted, use an empty dict.
    current_document = await db.viruses.find_one(virus_id)

    if current_document:
        current_document = await join(db, virus_id, current_document)
    else:
        current_document = {"_id": virus_id}

    _, patched, history_to_delete = await virtool.virus_history.patch_virus_to_version(
        db,
        current_document,
        virus_version,
        inclusive=True
    )

    # Remove the old sequences from the collection.
    await db.sequences.delete_many({"virus_id": virus_id})

    if patched is not None:
        patched_virus, sequences = virtool.virus.split_virus(patched)

        # Add the reverted sequences to the collection.
        await db.sequences.insert_many(sequences)

        # Replace the existing virus with the patched one. If it doesn't exist, insert it.
        await db.viruses.replace_one({"_id": virus_id}, patched_virus, upsert=True)

    else:
        await db.viruses.delete_one({"_id": virus_id})

    await db.history.remove(history_to_delete)

    return json_response(virtool.virus.processor(patched))
