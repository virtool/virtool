import asyncio
import logging
from pathlib import Path

import aiohttp.web

import virtool.api.utils
import virtool.db.utils
import virtool.history.db
import virtool.history.utils
import virtool.http.routes
import virtool.indexes.db
import virtool.indexes.files
import virtool.indexes.utils
import virtool.jobs.build_index
import virtool.jobs.db
import virtool.references.db
import virtool.uploads.db
import virtool.uploads.utils
import virtool.utils
from virtool.api.response import bad_request, conflict, insufficient_rights, invalid_query, json_response, \
    not_found, no_content
from virtool.indexes.db import reset_history, FILES
from virtool.indexes.models import IndexFile
from virtool.jobs.utils import JobRights

logger = logging.getLogger("indexes")
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


@routes.get("/api/indexes/{index_id}")
@routes.jobs_api.get("/api/indexes/{index_id}")
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


@routes.post("/api/indexes/{index_id}/files")
async def upload(req):
    """
    Upload a new index file to the `index_files` SQL table and the `references` folder in the Virtool
    data path.

    """
    db = req.app["db"]
    pg = req.app["pg"]
    index_id = req.match_info["index_id"]

    errors = virtool.uploads.utils.naive_validator(req)

    if errors:
        return invalid_query(errors)

    document = await db.indexes.find_one(index_id)

    if document is None:
        return not_found()

    file_name = req.query.get("name")

    if file_name not in FILES:
        return bad_request("Unsupported index file name")

    reference_id = document["reference"]["id"]
    file_type = virtool.indexes.utils.check_index_file_type(file_name)
    index_file = await virtool.indexes.files.create_index_file(pg, reference_id, file_type, file_name)
    file_id = index_file["id"]
    path = Path(req.app["settings"]["data_path"]) / "references" / reference_id / index_id / file_name

    if file_id in document.get("files", []):
        return conflict("File name already exists")

    try:
        size = await virtool.uploads.utils.naive_writer(req, path)
    except asyncio.CancelledError:
        logger.debug(f"Index file upload aborted: {file_id}")
        await virtool.indexes.files.delete_index_file(pg, file_id)

        return aiohttp.web.Response(status=499)

    index_file = await virtool.uploads.db.finalize(pg, size, file_id, IndexFile)

    await db.indexes.find_one_and_update({"_id": index_id}, {
        "$push": {
            "files": file_id
        }
    })

    headers = {
        "Location": f"/api/indexes/{index_id}/files/{file_name}"
    }

    return json_response(index_file, headers=headers, status=201)


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


@routes.jobs_api.delete("/api/indexes/{index_id}")
async def delete_index(req: aiohttp.web.Request):
    """Delete the index with the given id and reset history relating to that index."""
    index_id = req.match_info["index_id"]
    db = req.app["db"]

    delete_result = await db.indexes.delete_one({"_id": index_id})

    if delete_result.deleted_count != 1:
        # Document could not be deleted.
        return not_found(f"There is no index with id: {index_id}.")

    await reset_history(db, index_id)

    return no_content()


@routes.jobs_api.get("/api/indexes/{index_id}/files/{filename}")
async def download_index_file(req: aiohttp.web.Request):
    """Download files relating to a given index."""
    index_id = req.match_info["index_id"]
    filename = req.match_info["filename"]
    db = req.app["db"]

    index_document = await db.indexes.find_one(index_id)

    if index_document is None:
        return not_found()

    reference_id = index_document["reference"]["id"]

    path = Path(req.app["settings"]["data_path"]) / "references" / reference_id / index_id / filename

    if path.exists():
        return aiohttp.web.FileResponse(path)
    
    if filename not in FILES:
        return bad_request(f"{filename} must be one of {FILES}")
    return not_found("File not found")
