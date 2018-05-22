import virtool.db.history
import virtool.db.indexes
import virtool.db.references
import virtool.db.utils
import virtool.history
import virtool.http.routes
import virtool.jobs.build_index
import virtool.utils
from virtool.api.utils import json_response, not_found, compose_regex_query, paginate, conflict

routes = virtool.http.routes.Routes()


@routes.get("/api/indexes")
async def find(req):
    """
    Return a list of indexes.

    """
    db = req.app["db"]

    data = await virtool.db.indexes.find(db, req.query)

    return json_response(data)


@routes.get("/api/indexes/{index_id_or_version}")
async def get(req):
    """
    Get the complete document for a given index.

    """
    db = req.app["db"]

    document = await virtool.db.indexes.get_index(db, req.match_info["index_id_or_version"])

    if not document:
        return not_found()

    document = virtool.utils.base_processor(document)

    document["contributors"] = await virtool.db.indexes.get_contributors(db, document["id"])

    document["otus"] = await virtool.db.indexes.get_otus(db, document["id"])

    document["change_count"] = sum(v["change_count"] for v in document["otus"])

    return json_response(document)


@routes.post("/api/refs/{ref_id}/indexes")
async def create(req):
    """
    Starts a job to rebuild the otus Bowtie2 index on disk. Does a check to make sure there are no unverified
    otus in the collection and updates otu history to show the version and id of the new index.

    """
    db = req.app["db"]

    ref_id = req.match_info["ref_id"]

    if await db.indexes.count({"reference.id": ref_id, "ready": False}):
        return conflict("Index build already in progress")

    if await db.otus.count({"reference.id": ref_id, "verified": False}):
        return conflict("There are unverified otus")

    if not await db.history.count({"reference.id": ref_id, "index.id": "unbuilt"}):
        return conflict("There are no unbuilt changes")

    index_id = await virtool.db.utils.get_new_id(db.indexes)

    index_version = await virtool.db.indexes.get_next_version(db, ref_id)

    job_id = await virtool.db.utils.get_new_id(db.jobs)

    manifest = await virtool.db.references.get_manifest(db, ref_id)

    user_id = req["client"].user_id

    document = {
        "_id": index_id,
        "version": index_version,
        "created_at": virtool.utils.timestamp(),
        "manifest": manifest,
        "ready": False,
        "has_files": True,
        "job": {
            "id": job_id
        },
        "reference": {
            "id": ref_id
        },
        "user": {
            "id": user_id
        }
    }

    await db.indexes.insert_one(document)

    await db.history.update_many({"index.id": "unbuilt", "reference.id": ref_id}, {
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
    await req.app["job_manager"].new("build_index", task_args, user_id, job_id=job_id)

    headers = {
        "Location": "/api/indexes/" + index_id
    }

    return json_response(virtool.utils.base_processor(document), status=201, headers=headers)


@routes.get("/api/indexes/{index_id_or_version}/history")
async def find_history(req):
    """
    Find history changes for a specific index.

    """
    db = req.app["db"]

    document = await virtool.db.indexes.get_index(db, req.match_info["index_id_or_version"], projection=["_id"])

    if not document:
        return not_found()

    term = req.query.get("term", None)

    db_query = {
        "index.id": document["_id"]
    }

    if term:
        db_query.update(compose_regex_query(term, ["otu.name", "user.id"]))

    data = await paginate(
        db.history,
        db_query,
        req.query,
        sort=[("otu.name", 1), ("otu.version", -1)],
        projection=virtool.db.history.LIST_PROJECTION,
        reverse=True
    )

    return json_response(data)
