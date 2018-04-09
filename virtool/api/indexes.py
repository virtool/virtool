import virtool.db.history
import virtool.db.indexes
import virtool.history
import virtool.jobs.build_index
import virtool.utils
from virtool.api.utils import json_response, bad_request, not_found, compose_regex_query, paginate, \
    conflict


async def find(req):
    """
    Return a list of indexes.

    """
    db = req.app["db"]

    unbuilt_modified_kind_count = len(await db.history.distinct("kind.id", {"index.id": "unbuilt"}))

    total_kind_count = await db.kinds.count()

    data = await paginate(
        db.indexes,
        {},
        req.query,
        sort="version",
        projection=virtool.db.indexes.PROJECTION,
        reverse=True
    )

    for document in data["documents"]:
        document.update({
            "modified_kind_count": len(await db.history.distinct("kind.id", {"index.id": document["id"]})),
            "modification_count": await db.history.count({"index.id": document["id"]})
        })

    data.update({
        "modified_kind_count": unbuilt_modified_kind_count,
        "total_kind_count": total_kind_count
    })

    return json_response(data)


async def get(req):
    """
    Get the complete document for a given index.

    """
    db = req.app["db"]

    index_id_or_version = req.match_info["index_id_or_version"]

    try:
        document = await db.indexes.find_one({"version": int(index_id_or_version)})
    except ValueError:
        document = await db.indexes.find_one(index_id_or_version)

    if not document:
        return not_found()

    document = virtool.utils.base_processor(document)

    contributors = await db.history.aggregate([
        {"$match": {
            "index.id": document["id"]
        }},
        {"$group": {
            "_id": "$user.id",
            "count": {"$sum": 1}
        }}
    ]).to_list(None)

    document["contributors"] = [{"id": c["_id"], "count": c["count"]} for c in contributors]

    kinds = await db.history.aggregate([
        {"$match": {
            "index.id": document["id"]
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

    document["kinds"] = [{"id": v["_id"], "name": v["name"], "change_count": v["count"]} for v in kinds]

    document["change_count"] = sum(v["count"] for v in kinds)

    return json_response(document)


async def create(req):
    """
    Starts a job to rebuild the kindes Bowtie2 index on disk. Does a check to make sure there are no unverified
    kinds in the collection and updates kind history to show the version and id of the new index.

    """
    db = req.app["db"]

    ref_id = req.match_info["ref_id"]

    if await db.indexes.count({"ref.id": ref_id, "ready": False}):
        return conflict("Index build already in progress")

    if await db.kinds.count({"ref.id": ref_id, "verified": False}):
        return bad_request("There are unverified kinds")

    if not await db.history.count({"ref.id": ref_id, "index.id": "unbuilt"}):
        return bad_request("There are no unbuilt changes")

    index_id = await virtool.utils.get_new_id(db.indexes)
    index_version = await db.indexes.find({"ref.id": ref_id, "ready": True}).count()

    user_id = req["client"].user_id

    job_id = await virtool.utils.get_new_id(db.jobs)

    # Generate a dict of kind document version numbers keyed by the document id. We use this to make sure only changes
    # made at the time the index rebuild was started are
    manifest = dict()

    async for document in db.kinds.find({}, ["version"]):
        manifest[document["_id"]] = document["version"]

    await db.indexes.insert_one({
        "_id": index_id,
        "version": index_version,
        "created_at": virtool.utils.timestamp(),
        "manifest": manifest,
        "ready": False,
        "has_files": True,
        "job": {
            "id": job_id
        },
        "ref": {
            "id": ref_id
        },
        "user": {
            "id": user_id
        }
    })

    # Update all history entries with no index_version to the new index version.
    await db.history.update_many({"index.id": "unbuilt"}, {
        "$set": {
            "index": {
                "id": index_id,
                "version": index_version
            }
        }
    })

    # A dict of task_args for the rebuild job.
    task_args = {
        "ref_id": ref_id,
        "user_id": user_id,
        "index_id": index_id,
        "index_version": index_version,
        "manifest": manifest
    }

    # Start the job.
    await req.app["job_manager"].new("rebuild_index", task_args, user_id, job_id=job_id)

    document = await db.indexes.find_one(index_id)

    headers = {
        "Location": "/api/indexes/" + index_id
    }

    return json_response(virtool.utils.base_processor(document), status=201, headers=headers)


async def find_history(req):
    db = req.app["db"]

    index_id_or_version = req.match_info["index_id_or_version"]

    try:
        document = await db.indexes.find_one({"version": int(index_id_or_version)}, ["_id"])
    except ValueError:
        document = await db.indexes.find_one(index_id_or_version, ["_id"])

    if not document:
        return not_found()

    term = req.query.get("term", None)

    db_query = {
        "index.id": document["_id"]
    }

    if term:
        db_query.update(compose_regex_query(term, ["kind.name", "user.id"]))

    data = await paginate(
        db.history,
        db_query,
        req.query,
        sort=[("kind.name", 1), ("kind.version", -1)],
        projection=virtool.db.history.LIST_PROJECTION,
        reverse=True
    )

    return json_response(data)
