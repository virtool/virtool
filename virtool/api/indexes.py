import virtool.db.history
import virtool.db.indexes
import virtool.history
import virtool.jobs.rebuild_index
import virtool.utils
from virtool.api.utils import json_response, bad_request, not_found, protected, compose_regex_query, paginate, \
    conflict


async def find(req):
    """
    Return a list of indexes.

    """
    db = req.app["db"]

    unbuilt_modified_virus_count = len(await db.history.distinct("virus.id", {"index.id": "unbuilt"}))

    total_virus_count = await db.viruses.count()

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
            "modified_virus_count": len(await db.history.distinct("virus.id", {"index.id": document["id"]})),
            "modification_count": await db.history.count({"index.id": document["id"]})
        })

    data.update({
        "modified_virus_count": unbuilt_modified_virus_count,
        "total_virus_count": total_virus_count
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

    viruses = await db.history.aggregate([
        {"$match": {
            "index.id": document["id"]
        }},
        {"$sort": {
            "virus.id": 1,
            "virus.version": -1
        }},
        {"$group": {
            "_id": "$virus.id",
            "name": {"$first": "$virus.name"},
            "count": {"$sum": 1}
        }},
        {"$match": {
            "name": {"$ne": None}
        }},
        {"$sort": {
            "name": 1
        }}
    ]).to_list(None)

    document["viruses"] = [{"id": v["_id"], "name": v["name"], "change_count": v["count"]} for v in viruses]

    document["change_count"] = sum(v["count"] for v in viruses)

    return json_response(document)


async def get_unbuilt(req):
    """
    Get a JSON document describing the unbuilt changes that could be used to create a new index.

    """
    db = req.app["db"]

    history = await db.history.find({"index.id": "unbuilt"}, virtool.db.history.LIST_PROJECTION).to_list(None)

    return json_response({
        "history": [virtool.utils.base_processor(c) for c in history]
    })


@protected("rebuild_index")
async def create(req):
    """
    Starts a job to rebuild the viruses Bowtie2 index on disk. Does a check to make sure there are no unverified
    viruses in the collection and updates virus history to show the version and id of the new index.

    """
    db = req.app["db"]

    if await db.indexes.count({"ready": False}):
        return conflict("Index build already in progress")

    if await db.viruses.count({"verified": False}):
        return bad_request("There are unverified viruses")

    if not await db.history.count({"index.id": "unbuilt"}):
        return bad_request("There are no unbuilt changes")

    index_id = await virtool.utils.get_new_id(db.indexes)
    index_version = await virtool.db.indexes.get_current_index_version(db) + 1

    user_id = req["client"].user_id

    job_id = await virtool.utils.get_new_id(db.jobs)

    # Generate a dict of virus document version numbers keyed by the document id. We use this to make sure only changes
    # made at the time the index rebuild was started are
    virus_manifest = dict()

    async for document in db.viruses.find({}, ["version"]):
        virus_manifest[document["_id"]] = document["version"]

    await db.indexes.insert_one({
        "_id": index_id,
        "version": index_version,
        "created_at": virtool.utils.timestamp(),
        "manifest": virus_manifest,
        "ready": False,
        "has_files": True,
        "user": {
            "id": user_id
        },
        "job": {
            "id": job_id
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
        "user_id": user_id,
        "index_id": index_id,
        "index_version": index_version,
        "virus_manifest": virus_manifest
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
        db_query.update(compose_regex_query(term, ["virus.name", "user.id"]))

    data = await paginate(
        db.history,
        db_query,
        req.query,
        sort=[("virus.name", 1), ("virus.version", -1)],
        projection=virtool.db.history.LIST_PROJECTION,
        reverse=True
    )

    return json_response(data)
