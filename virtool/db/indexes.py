PROJECTION = [
    "_id",
    "version",
    "created_at",
    "virus_count",
    "modification_count",
    "modified_virus_count",
    "user",
    "ready",
    "has_files",
    "job"
]


async def get_active_index_ids(db):
    active_indexes = set()

    async for agg in db.analyses.aggregate([{"$match": {"ready": False}}, {"$group": {"_id": "$index.id"}}]):
        active_indexes.add(agg["_id"])

    current_index_id, _ = await get_current_index(db)

    active_indexes.add(current_index_id)

    unready_index = await db.indexes.find_one({"ready": False})

    if unready_index:
        active_indexes.add(unready_index["_id"])

    try:
        active_indexes.remove("unbuilt")
    except KeyError:
        pass

    return list(active_indexes)


async def get_current_index_version(db):
    """
    Get the current (latest) index version number.

    """
    # Make sure only one index is in the 'ready' state.
    index_count = await db.indexes.find({"ready": True}).count()

    # Index versions start at 0. Returns -1 if no indexes exist.
    return index_count - 1


async def get_current_index(db):
    """
    Return the current index id and version number.

    """
    current_index_version = await get_current_index_version(db)

    if current_index_version == -1:
        return None

    index_id = (await db.indexes.find_one({"version": current_index_version}))["_id"]

    return index_id, current_index_version
