import pymongo

import virtool.history.db
from virtool.api import paginate

PROJECTION = [
    "_id",
    "created_at",
    "has_files",
    "job",
    "otu_count",
    "modification_count",
    "modified_count",
    "user",
    "ready",
    "reference",
    "version"
]


async def find(db, req_query, ref_id=None):
    base_query = None

    if ref_id:
        base_query = {
            "reference.id": ref_id
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

    data.update(await get_unbuilt_stats(db, ref_id))

    return data


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
    return await virtool.history.db.get_contributors(db, {"index.id": index_id})


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
        {"reference.id": ref_id, "ready": True},
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


async def get_otus(db, index_id):
    """
    Return a list of otus and number of changes for a specific index.

    :param db: the application database client
    :type db: :class:`~motor.motor_asyncio.AsyncIOMotorClient`

    :param index_id: the id of the index to get otus for
    :type index_id: str

    :return: a list of otus modified in the index
    :rtype: List[dict]

    """
    cursor = db.history.aggregate([
        {"$match": {
            "index.id": index_id
        }},
        {"$sort": {
            "otu.id": 1,
            "otu.version": -1
        }},
        {"$group": {
            "_id": "$otu.id",
            "name": {"$first": "$otu.name"},
            "count": {"$sum": 1}
        }},
        {"$match": {
            "name": {"$ne": None}
        }},
        {"$sort": {
            "name": 1
        }}
    ])

    return [{"id": v["_id"], "name": v["name"], "change_count": v["count"]} async for v in cursor]


async def get_modification_stats(db, index_id):
    """
    Get the number of modified otus and the number of changes made for a specific index.

    :param db: the application database client
    :type db: :class:`~motor.motor_asyncio.AsyncIOMotorClient`

    :param index_id: the id of the index to return counts for
    :type index_id: str

    :return: the modified otu count and change count
    :rtype: Tuple[int, int]

    """
    query = {
        "index.id": index_id
    }

    return {
        "change_count": await db.history.count(query),
        "modified_otu_count": len(await db.history.distinct("otu.id", query))
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
    return await db.indexes.find({"reference.id": ref_id, "ready": True}).count()


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
    await db.history.update_many({"reference.id": ref_id, "index.id": "unbuilt"}, {
        "$set": {
            "index": {
                "id": index_id,
                "version": index_version
            }
        }
    })


async def get_unbuilt_stats(db, ref_id=None):
    """
    Get the number of unbuilt changes and number of OTUs affected by those changes. Used to populate the metadata for a
    index find request.

    Can search against a specific reference or all references.

    :param db: the application database client
    :type db: :class:`~motor.motor_asyncio.AsyncIOMotorClient`

    :param ref_id: the ref id to search unbuilt changes for
    :type ref_id: str

    :return: the change count and modified OTU count
    :rtype: dict

    """
    ref_query = dict()

    if ref_id:
        ref_query["reference.id"] = ref_id

    history_query = {
        **ref_query,
        "index.id": "unbuilt"
    }

    return {
        "total_otu_count": await db.otus.count(ref_query),
        "change_count": await db.history.count(history_query),
        "modified_otu_count": len(await db.history.distinct("otu.id", history_query))
    }
