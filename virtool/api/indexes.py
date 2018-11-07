import virtool.db.history
import virtool.db.indexes
import virtool.db.jobs
import virtool.db.references
import virtool.db.utils
import virtool.history
import virtool.http.routes
import virtool.jobs.build_index
import virtool.utils
from virtool.api.utils import bad_request, compose_regex_query, conflict, insufficient_rights, json_response, \
    not_found, paginate

routes = virtool.http.routes.Routes()


@routes.get("/api/indexes")
async def find(req):
    """
    Return a list of indexes.

    """
    db = req.app["db"]

    ready = req.query.get("ready", False)

    if not ready:
        data = await virtool.db.indexes.find(db, req.query)
        return json_response(data)

    pipeline = [
        {
            "$match": {
                "ready": True
            }
        },
        {
            "$sort": {
                "version": -1
            }
        },
        {
            "$group": {
                "_id": "$reference.id",
                "index": {
                    "$first": "$_id"
                },
                "version": {
                    "$first": "$version"
                }
            }
        }
    ]

    ready_indexes = list()

    async for agg in db.indexes.aggregate(pipeline):
        reference_name = await virtool.db.utils.get_one_field(db.references, "name", agg["_id"])

        ready_indexes.append({
            "id": agg["index"],
            "version": agg["version"],
            "reference": {
                "id": agg["_id"],
                "name": reference_name
            }
        })

    return json_response(ready_indexes)


@routes.get("/api/indexes/{index_id}")
async def get(req):
    """
    Get the complete document for a given index.

    """
    db = req.app["db"]

    index_id = req.match_info["index_id"]

    document = await db.indexes.find_one(index_id)

    if not document:
        return not_found()

    document = virtool.utils.base_processor(document)

    document["contributors"] = await virtool.db.indexes.get_contributors(db, index_id)

    document["otus"] = await virtool.db.indexes.get_otus(db, index_id)

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

    reference = await db.references.find_one(ref_id, ["groups", "users"])

    if reference is None:
        return not_found()

    if not await virtool.db.references.check_right(req, reference, "build"):
        return insufficient_rights()

    if await db.indexes.count({"reference.id": ref_id, "ready": False}):
        return conflict("Index build already in progress")

    if await db.otus.count({"reference.id": ref_id, "verified": False}):
        return bad_request("There are unverified OTUs")

    if not await db.history.count({"reference.id": ref_id, "index.id": "unbuilt"}):
        return bad_request("There are no unbuilt changes")

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

    # Create job document.
    job = await virtool.db.jobs.create(
        db,
        req.app["settings"],
        "build_index",
        task_args,
        user_id,
        job_id=job_id
    )

    await req.app["jobs"].enqueue(job["_id"])

    headers = {
        "Location": "/api/indexes/" + index_id
    }

    return json_response(virtool.utils.base_processor(document), status=201, headers=headers)


@routes.get("/api/indexes/{index_id}/history")
async def find_history(req):
    """
    Find history changes for a specific index.

    """
    db = req.app["db"]

    index_id = req.match_info["index_id"]

    if not await db.indexes.count({"_id": index_id}):
        return not_found()

    term = req.query.get("term", None)

    db_query = {
        "index.id": index_id
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
