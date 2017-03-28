from aiohttp import web
from virtool.viruses import extract_isolate_ids
from virtool.history import get_versioned_document
from virtool.handler_utils import unpack_json_request

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

    return web.json_response({"reverted": history_to_delete})
