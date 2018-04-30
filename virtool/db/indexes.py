import pymongo

import virtool.db.history
from virtool.api.utils import paginate

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


async def create_manifest(db, ref_id):
    """
    Generate a dict of kind document version numbers keyed by the document id. This is used to make sure only changes
    made at the time the index rebuild was started are included in the build.

    :param db: the application database client
    :type db: :class:`~motor.motor_asyncio.AsyncIOMotorClient`

    :param ref_id: the id of the reference to get the current index for
    :type ref_id: str


    :return: a manifest of kind ids and versions
    :rtype: dict

    """
    manifest = dict()

    async for document in db.kinds.find({"ref.id": ref_id}, ["version"]):
        manifest[document["_id"]] = document["version"]

    return manifest


async def find(db, req_query, ref_id=None):
    base_query = None

    if ref_id:
        base_query = {
            "ref.id": ref_id
        }

    data = await paginate(
        db.indexes,
        {},
        req_query,
        base_query=base_query,
        projection=PROJECTION,
        reverse=True,
        sort="version"
    )

    for document in data["documents"]:
        document.update(await get_modification_stats(db, document["id"]))

    return data


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

    current_index_id, _ = await get_current_id_and_version(db, ref_id)

    active_indexes.add(current_index_id)

    unready_index = await db.indexes.find_one({"ready": False})

    if unready_index:
        active_indexes.add(unready_index["_id"])

    try:
        active_indexes.remove("unbuilt")
    except KeyError:
        pass

    return list(active_indexes)


async def get_contributors(db, index_id):
    """
    Return an list of contributors and their contribution count for a specific index.

    :param db: the application database client
    :type db: :class:`~motor.motor_asyncio.AsyncIOMotorClient`

    :param index_id: the id of the index to get contributors for
    :type index_id: str

    :return: a list of contributors to the index
    :rtype: List[dict]

    """
    return await virtool.db.history.get_contributors(db, {"index.id": index_id})


async def get_current_id_and_version(db, ref_id):
    """
    Return the current index id and version number.

    :param db: the application database client
    :type db: :class:`~motor.motor_asyncio.AsyncIOMotorClient`

    :param ref_id: the id of the reference to get the current index for
    :type ref_id: str

    :return: the index and version of the current index
    :rtype: Tuple[str, int]

    """
    document = await db.indexes.find_one(
        {"ref.id": ref_id, "has_files": True, "ready": True},
        sort=[("version", pymongo.DESCENDING)],
        projection=["_id", "version"]
    )

    if document is None:
        return None, -1

    return document["_id"], document["version"]


async def get_index(db, index_id_or_version, projection=None):
    """
    Get an index document by its ``id`` or ``version``.

    :param db: the application database client
    :type db: :class:`~motor.motor_asyncio.AsyncIOMotorClient`

    :param index_id_or_version: the id of the index
    :type index_id_or_version: Union[str, int]

    :param projection: a Mongo projection to apply to the result
    :type projection: Union[None, dict, list]

    :return: an index document
    :rtype: Union[None, dict]

    """
    try:
        return await db.indexes.find_one({"version": int(index_id_or_version)}, projection=projection)
    except ValueError:
        return await db.indexes.find_one(index_id_or_version, projection=projection)


async def get_kinds(db, index_id):
    """
    Return a list of kinds and number of changes for a specific index.

    :param db: the application database client
    :type db: :class:`~motor.motor_asyncio.AsyncIOMotorClient`

    :param index_id: the id of the index to get kinds for
    :type index_id: str

    :return: a list of kinds modified in the index
    :rtype: List[dict]

    """
    kinds = await db.history.aggregate([
        {"$match": {
            "index.id": index_id
        }},
        {"$sort": {
            "kind.id": 1,
            "kind.version": -1
        }},
        {"$group": {
            "_id": "$kind.id",
            "name": {"$first": "$kind.name"},
            "count": {"$sum": 1}
        }},
        {"$match": {
            "name": {"$ne": None}
        }},
        {"$sort": {
            "name": 1
        }}
    ]).to_list(None)

    return [{"id": v["_id"], "name": v["name"], "change_count": v["count"]} for v in kinds]


async def get_modification_stats(db, index_id):
    """
    Get the number of modified kinds and the number of changes made for a specific index.

    :param db: the application database client
    :type db: :class:`~motor.motor_asyncio.AsyncIOMotorClient`

    :param index_id: the id of the index to return counts for
    :type index_id: str

    :return: the modified kind count and change count
    :rtype: Tuple[int, int]

    """
    query = {
        "index.id": index_id
    }

    return {
        "change_count": await db.history.count(query),
        "modified_kind_count": len(await db.history.distinct("kind.id", query))
    }


async def get_next_version(db, ref_id):
    """
    Get the version number that should be used for the next index build.

    :param db: the application database client
    :type db: :class:`~motor.motor_asyncio.AsyncIOMotorClient`

    :param ref_id: the id of the reference to get the next version for
    :type ref_id: str

    :return: the next version number
    :rtype: int

    """
    return await db.indexes.find({"ref.id": ref_id, "ready": True}).count()


async def tag_unbuilt_changes(db, ref_id, index_id, index_version):
    """
    Update the ``index`` field for all unbuilt history changes for a specific ref to be included in the index described
    the passed ``index_id`` and ``index_version``.

    :param db: the application database client
    :type db: :class:`~motor.motor_asyncio.AsyncIOMotorClient`

    :param ref_id: the ref id to tag changes for
    :type ref_id: str

    :param index_id: the index id to tag changes unbuilt with
    :type index_id: str

    :param index_version: the index version to tag unbuilt changes with
    :type index_version: int

    """
    await db.history.update_many({"ref.id": ref_id, "index.id": "unbuilt"}, {
        "$set": {
            "index": {
                "id": index_id,
                "version": index_version
            }
        }
    })
