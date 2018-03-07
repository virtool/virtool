import virtool.utils
import virtool.virus
import virtool.virus_history
from virtool.handlers.utils import json_response, no_content, not_found, paginate, protected


async def find(req):
    """
    Get a list of change documents.

    """
    db = req.app["db"]

    data = await paginate(
        db.history,
        {},
        req.query,
        sort="created_at",
        projection=virtool.virus_history.LIST_PROJECTION,
        reverse=True
    )

    return json_response(data)


async def get(req):
    """
    Get a specific change document by its ``change_id``.

    """
    db = req.app["db"]

    change_id = req.match_info["change_id"]

    document = await db.history.find_one(change_id, virtool.virus_history.PROJECTION)

    if not document:
        return not_found()

    return json_response(virtool.utils.base_processor(document))


@protected("modify_virus")
async def revert(req):
    """
    Remove the change document with the given ``change_id`` and any subsequent changes.

    """
    db = req.app["db"]

    change_id = req.match_info["change_id"]

    change = await db.history.find_one({"_id": change_id}, ["index"])

    if not change:
        return not_found()

    virus_id, virus_version = change_id.split(".")

    if virus_version != "removed":
        virus_version = int(virus_version)

    _, patched, history_to_delete = await virtool.virus_history.patch_virus_to_version(
        db,
        virus_id,
        virus_version - 1
    )

    # Remove the old sequences from the collection.
    await db.sequences.delete_many({"virus_id": virus_id})

    if patched is not None:
        patched_virus, sequences = virtool.virus.split_virus(patched)

        # Add the reverted sequences to the collection.
        if len(sequences):
            await db.sequences.insert_many(sequences)

        # Replace the existing virus with the patched one. If it doesn't exist, insert it.
        await db.viruses.replace_one({"_id": virus_id}, patched_virus, upsert=True)

    else:
        await db.viruses.delete_one({"_id": virus_id})

    await db.history.delete_many({"_id": {"$in": history_to_delete}})

    return no_content()
