import asyncio

import aiohttp

import virtool.api.utils
import virtool.db.utils
import virtool.history.db
import virtool.history.utils
import virtool.http.routes
import virtool.indexes.db
import virtool.jobs.build_index
import virtool.jobs.db
import virtool.references.db
import virtool.utils
from virtool.api.response import bad_request, conflict, insufficient_rights, json_response, \
    not_found, no_content
from virtool.db.core import Collection
from virtool.jobs.utils import JobRights

routes = virtool.http.routes.Routes()


@routes.get("/api/indexes")
async def find(req):
    """
    Return a list of indexes.

    """
    db = req.app["db"]

    ready = req.query.get("ready", False)

    if not ready:
        data = await virtool.indexes.db.find(db, req.query)
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
        reference = await db.references.find_one(agg["_id"], ["data_type", "name"])

        ready_indexes.append({
            "id": agg["index"],
            "version": agg["version"],
            "reference": {
                "id": agg["_id"],
                "name": reference["name"],
                "data_type": reference["data_type"]
            }
        })

    return json_response(ready_indexes)


@routes.get("/api/indexes/{index_id}", allow_jobs=True)
async def get(req):
    """
    Get the complete document for a given index.

    """
    db = req.app["db"]

    index_id = req.match_info["index_id"]

    document = await db.indexes.find_one(index_id)

    if not document:
        return not_found()

    contributors, otus = await asyncio.gather(
        virtool.indexes.db.get_contributors(db, index_id),
        virtool.indexes.db.get_otus(db, index_id)
    )

    document.update({
        "change_count": sum(v["change_count"] for v in otus),
        "contributors": contributors,
        "otus": otus,
    })

    document = await virtool.indexes.db.processor(db, document)

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

    if not await virtool.references.db.check_right(req, reference, "build"):
        return insufficient_rights()

    if await db.indexes.count_documents({"reference.id": ref_id, "ready": False}):
        return conflict("Index build already in progress")

    if await db.otus.count_documents({"reference.id": ref_id, "verified": False}):
        return bad_request("There are unverified OTUs")

    if not await db.history.count_documents({"reference.id": ref_id, "index.id": "unbuilt"}):
        return bad_request("There are no unbuilt changes")

    index_id = await virtool.db.utils.get_new_id(db.indexes)

    index_version = await virtool.indexes.db.get_next_version(db, ref_id)

    job_id = await virtool.db.utils.get_new_id(db.jobs)

    manifest = await virtool.references.db.get_manifest(db, ref_id)

    user_id = req["client"].user_id

    document = {
        "_id": index_id,
        "version": index_version,
        "created_at": virtool.utils.timestamp(),
        "manifest": manifest,
        "ready": False,
        "has_files": True,
        "has_json": False,
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

    rights = JobRights()
    rights.indexes.can_modify(index_id)
    rights.references.can_read(ref_id)

    # Create job document.
    job = await virtool.jobs.db.create(
        db,
        "build_index",
        task_args,
        user_id,
        rights,
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

    if not await db.indexes.count_documents({"_id": index_id}):
        return not_found()

    term = req.query.get("term")

    db_query = {
        "index.id": index_id
    }

    if term:
        db_query.update(virtool.api.utils.compose_regex_query(term, ["otu.name", "user.id"]))

    data = await virtool.api.utils.paginate(
        db.history,
        db_query,
        req.query,
        sort=[("otu.name", 1), ("otu.version", -1)],
        projection=virtool.history.db.LIST_PROJECTION,
        reverse=True
    )

    return json_response(data)


async def reset_history(history: Collection, index_id: str):
    """
    Set the index.id and index.version fields with the given index id to 'unbuilt'.

    :param history: The history collection of the database.
    :param index_id: The ID of the index which failed to build
    """
    query = {
        "_id": {
            "$in": await history.distinct("_id", {"index.id": index_id})
        }
    }

    return await history.update_many(query, {
        "$set": {
            "index": {
                "id": "unbuilt",
                "version": "unbuilt"
            }
        }
    })


@routes.delete("/api/indexes/{index_id}", jobs_only=True)
async def delete_index(req: aiohttp.web.Request):
    """Delete the index with the given id and reset history relating to that index."""
    index_id = req.match_info["index_id"]
    db = req.app["db"]
    indexes: Collection = db.indexes

    delete_result = await indexes.delete_one({"_id": index_id})

    if delete_result.deleted_count != 1:
        # Document could not be deleted.
        return not_found(f"There is no index with id: {index_id}.")

    await reset_history(db.history, index_id)

    return no_content()
