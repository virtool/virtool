import virtool.db.history
import virtool.history
import virtool.kinds
import virtool.utils
from virtool.api.utils import conflict, json_response, no_content, not_found, paginate


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
        projection=virtool.db.history.LIST_PROJECTION,
        reverse=True
    )

    return json_response(data)


async def get(req):
    """
    Get a specific change document by its ``change_id``.

    """
    db = req.app["db"]

    change_id = req.match_info["change_id"]

    document = await db.history.find_one(change_id, virtool.db.history.PROJECTION)

    if not document:
        return not_found()

    return json_response(virtool.utils.base_processor(document))


async def revert(req):
    """
    Remove the change document with the given ``change_id`` and any subsequent changes.

    """
    db = req.app["db"]

    change_id = req.match_info["change_id"]

    change = await db.history.find_one({"_id": change_id}, ["index"])

    if not change:
        return not_found()

    if change["index"]["id"] != "unbuilt" or change["index"]["version"] != "unbuilt":
        return conflict("Not unbuilt")

    kind_id, kind_version = change_id.split(".")

    if kind_version != "removed":
        kind_version = int(kind_version)

    _, patched, history_to_delete = await virtool.db.history.patch_to_version(
        db,
        kind_id,
        kind_version - 1
    )

    # Remove the old sequences from the collection.
    await db.sequences.delete_many({"kind_id": kind_id})

    if patched is not None:
        patched_kind, sequences = virtool.kinds.split(patched)

        # Add the reverted sequences to the collection.
        if len(sequences):
            await db.sequences.insert_many(sequences)

        # Replace the existing kind with the patched one. If it doesn't exist, insert it.
        await db.kinds.replace_one({"_id": kind_id}, patched_kind, upsert=True)

    else:
        await db.kinds.delete_one({"_id": kind_id})

    await db.history.delete_many({"_id": {"$in": history_to_delete}})

    return no_content()
