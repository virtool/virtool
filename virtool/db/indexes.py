import pymongo

PROJECTION = [
    "_id",
    "created_at",
    "has_files",
    "job",
    "kind_count",
    "modification_count",
    "modified_count",
    "user",
    "ready",
    "ref",
    "version"
]


async def get_active_index_ids(db, ref_id):
    active_indexes = set()

    pipeline = [
        {
            "$match": {
                "ready": False,
                "ref.id": ref_id
            }
        },
        {
            "$group": {
                "_id": "$index.id"
            }
        }
    ]

    async for agg in db.analyses.aggregate(pipeline):
        active_indexes.add(agg["_id"])

    current_index_id, _ = await get_current_index(db, ref_id)

    active_indexes.add(current_index_id)

    unready_index = await db.indexes.find_one({"ready": False})

    if unready_index:
        active_indexes.add(unready_index["_id"])

    try:
        active_indexes.remove("unbuilt")
    except KeyError:
        pass

    return list(active_indexes)


async def get_current_index(db, ref_id):
    """
    Return the current index id and version number.

    """
    document = await db.indexes.find_one(
        {"ref.id": ref_id, "ready": True},
        sort=[("version", pymongo.DESCENDING)],
        projection=["_id", "version"]
    )

    return document["_id"], document["version"]
