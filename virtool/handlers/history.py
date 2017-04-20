from virtool.viruses import extract_isolate_ids
from virtool.handlers.utils import json_response, not_found
from virtool.history import get_versioned_document, PROJECTION, DISPATCH_PROJECTION, processor
from virtool.handlers.utils import unpack_json_request


async def find(req):
    db = req.app["db"]

    documents = await db.history.find({}, DISPATCH_PROJECTION).to_list(length=15)

    return json_response([processor(document) for document in documents])


async def get(req):
    db = req.app["db"]

    change_id = req.match_info["change_id"]

    document = await db.history.find_one(change_id, PROJECTION)

    if not document:
        return not_found()

    return json_response(processor(document))


async def revert(req):
    db, data = await unpack_json_request(req)

    document, patched, history_to_delete = await get_versioned_document(
        db,
        data["entry_id"],
        data["entry_version"]
    )

    isolate_ids = extract_isolate_ids(document or patched)

    # Remove the old sequences from the collection.
    await db.sequences.remove({"isolate_id": {"$in": isolate_ids}})

    if patched != "remove":
        # Add the reverted sequences to the collection.
        for isolate in patched["isolates"]:
            for sequence in isolate["sequences"]:
                await db.sequences.insert_one(sequence)

        if document:
            await db.viruses.update({"_id": document["_id"]}, {"$set": patched})
        else:
            await db.viruses.insert(patched)

    else:
        await db.viruses.remove(document["_id"])

    await db.history.remove(history_to_delete)

    return json_response({"reverted": history_to_delete})
