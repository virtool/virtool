import os

from virtool.utils import rm

sync_projector = [
    "_id",
    "_version",
    "timestamp",
    "virus_count",
    "modification_count",
    "modified_virus_count",
    "username",
    "index_version",
    "ready",
    "has_files"
]


async def set_stats(db, index_id, data):
    """
    Updates the index document with data describing the changes made to the virus reference since the last index
    build:

    * modification_count - the number of changes recorded since the last index build.
    * modified_virus_count - The number of viruses modified since the last index build.
    * virus_count - Number of viruses now present in the viruses collection.

    """
    return await db.indexes.update(index_id, {"$set": data})


async def set_ready(db, index_id):
    """
    Updates the index document described by the passed index id to show whether it is ready or not.

    """
    return await db.indexes.update({"_id": index_id}, {
        "$set": {
            "ready": True
        }
    })


async def cleanup_index_files(db, settings):
    """
    Cleans up unused index dirs. Only the **active** index (latest ready index) is ever available for running
    analysis from the web client. Any older indexes are removed from disk. If a running analysis still needs an old
    index, it cannot be removed.

    This method removes old index dirs while ensuring to retain old ones that are still references by pending
    analyses.

    """
    aggregation_cursor = await db.analyses.aggregate([
        {"$match": {"ready": False}},
        {"$group": {"_id": "$index_id"}}
    ])

    # The indexes (_ids) currently in use by running analysis jobs.
    active_indexes = list()

    while await aggregation_cursor.fetch_next:
        active_indexes.append(aggregation_cursor.next_object()["_id"])

    # The newest index version.
    current_index_id, _ = await get_current_index(db)
    active_indexes.append(current_index_id)

    # Any rebuilding index
    unready_index = await db.indexes.find_one({"ready": False}, ["_id"])

    if unready_index:
        active_indexes.append(unready_index["_id"])

    try:
        active_indexes.remove("unbuilt")
    except ValueError:
        pass

    active_indexes = list(set(active_indexes))

    await db.indexes.update({"_id": {"$in": active_indexes}}, {
        "$set": {
            "has_files": False
        }
    })

    base_path = os.path.join(settings.get("data_path"), "reference/viruses")

    for dir_name in os.listdir(base_path):
        if dir_name not in active_indexes:
            try:
                await rm(os.path.join(base_path, dir_name), recursive=True)
            except OSError:
                pass


async def get_current_index_version(db):
    """
    Get the current (latest) index version number.

    """
    # Make sure only one index is in the 'ready' state.
    index_count = await db.indexes.find({"ready": True}).count()

    assert index_count > -1

    # Index versions start at 0. Returns -1 if no indexes exist.
    return index_count - 1


async def get_current_index(db):
    """
    Return the current index id and version number.

    """
    current_index_version = await get_current_index_version(db)

    if current_index_version == -1:
        return None

    index_id = (await db.indexes.find_one({"index_version": current_index_version}))["_id"]

    return index_id, current_index_version
