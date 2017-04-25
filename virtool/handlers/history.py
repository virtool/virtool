import virtool.virus_history

from virtool.virus import extract_isolate_ids
from virtool.handlers.utils import unpack_json_request, json_response, not_found


async def find(req):
    db = req.app["db"]

    documents = await db.history.find({}, virtool.virus_history.DISPATCH_PROJECTION).to_list(length=15)

    return json_response([virtool.virus_history.processor(document) for document in documents])


async def get(req):
    db = req.app["db"]

    change_id = req.match_info["change_id"]

    document = await db.history.find_one(change_id, virtool.virus_history.PROJECTION)

    if not document:
        return not_found()

    return json_response(virtool.virus_history.processor(document))


async def revert(req):
    db, data = await unpack_json_request(req)

    document, patched, history_to_delete = await virtool.virus_history.get_versioned_document(
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
