import asyncio
import json
import logging

import aiohttp.web
from aiohttp.web_exceptions import HTTPNoContent
from aiohttp.web_fileresponse import FileResponse
from sqlalchemy import exc

import virtool.http.routes
import virtool.indexes.db
import virtool.jobs.db
import virtool.references.db
import virtool.uploads.db
import virtool.utils
from virtool.api.json import CustomEncoder
from virtool.api.response import bad_request, conflict, insufficient_rights, json_response, not_found
from virtool.api.utils import compose_regex_query, paginate
from virtool.db.utils import get_new_id
from virtool.history.db import LIST_PROJECTION
from virtool.indexes.db import FILES, reset_history
from virtool.indexes.files import create_index_file
from virtool.indexes.models import IndexFile, IndexType
from virtool.indexes.utils import check_index_file_type
from virtool.jobs.utils import JobRights
from virtool.pg.utils import delete_row, get_rows
from virtool.uploads.utils import naive_writer
from virtool.utils import compress_json_with_gzip

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
    pg = req.app["pg"]

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

    document = await virtool.indexes.db.attach_files(pg, document)

    document = await virtool.indexes.db.processor(db, document)

    return json_response(document)


@routes.jobs_api.get("/api/indexes/{index_id}/files/otus.json.gz")
async def download_otus_json(req):
    """
    Download a complete compressed JSON representation of the index OTUs.

    """
    db = req.app["db"]
    index_id = req.match_info["index_id"]

    index = await db.indexes.find_one(index_id)

    if index is None:
        return not_found()

    ref_id = index["reference"]["id"]

    data_path = req.app["settings"]["data_path"]
    json_path = data_path / f"references/{ref_id}/{index_id}/otus.json.gz"

    if not json_path.exists():
        patched_otus = await virtool.indexes.db.get_patched_otus(
            db,
            req.app["settings"],
            index["manifest"]
        )

        json_string = json.dumps(patched_otus, cls=CustomEncoder)

        await req.app["run_in_thread"](compress_json_with_gzip, json_string, json_path)

    headers = {
        "Content-Disposition": "attachment; filename=otus.json.gz",
        "Content-Type": "application/gzip"
    }

    return FileResponse(json_path, headers=headers)


@routes.jobs_api.get("/api/indexes/{index_id}/files/{filename}")
async def download_index_file(req: aiohttp.web.Request):
    """Download files relating to a given index."""
    index_id = req.match_info["index_id"]
    filename = req.match_info["filename"]

    if filename not in FILES:
        return not_found()

    index_document = await req.app["db"].indexes.find_one(index_id)

    if index_document is None:
        return not_found()

    reference_id = index_document["reference"]["id"]

    path = req.app["settings"]["data_path"] / "references" / reference_id / index_id / filename

    if not path.exists():
        return not_found("File not found")

    return aiohttp.web.FileResponse(path)


@routes.post("/api/refs/{ref_id}/indexes")
async def create(req):
    """
    Starts a job to rebuild the otus Bowtie2 index on disk. Does a check to make sure there are no
    unverified OTUs in the collection and updates otu history to show the version and id of the new
    index.

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

    user_id = req["client"].user_id
    job_id = await get_new_id(db.jobs)

    document = await virtool.indexes.db.create(db, ref_id, user_id, job_id)

    # A dict of task_args for the rebuild job.
    task_args = {
        "ref_id": ref_id,
        "user_id": user_id,
        "index_id": document["_id"],
        "index_version": document["version"],
        "manifest": document["manifest"]
    }

    rights = JobRights()
    rights.indexes.can_modify(document["_id"])
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
        "Location": "/api/indexes/" + document["_id"]
    }

    return json_response(virtool.utils.base_processor(document), status=201, headers=headers)


@routes.jobs_api.put("/api/indexes/{index_id}/files/{filename}")
async def upload(req):
    """
    Upload a new index file to the `index_files` SQL table and the `references` folder in the
    Virtool data path.

    """
    db = req.app["db"]
    pg = req.app["pg"]
    index_id = req.match_info["index_id"]
    name = req.match_info["filename"]

    if name not in FILES:
        return not_found("Index file not found")

    document = await db.indexes.find_one(index_id)

    if document is None:
        return not_found()

    reference_id = document["reference"]["id"]
    file_type = check_index_file_type(name)

    try:
        index_file = await create_index_file(
            pg,
            index_id,
            file_type,
            name
        )
    except exc.IntegrityError:
        return conflict("File name already exists")

    upload_id = index_file["id"]
    path = req.app["settings"]["data_path"] / "references" / reference_id / index_id / name

    try:
        size = await naive_writer(req, path)
    except asyncio.CancelledError:
        logger.debug(f"Index file upload aborted: {upload_id}")
        await delete_row(pg, upload_id, IndexFile)

        return aiohttp.web.Response(status=499)

    index_file = await virtool.uploads.db.finalize(pg, size, upload_id, IndexFile)

    headers = {
        "Location": f"/api/indexes/{index_id}/files/{name}"
    }

    index_file["uploaded_at"] = virtool.utils.timestamp()

    return json_response(index_file, headers=headers, status=201)


@routes.jobs_api.patch("/api/indexes/{index_id}")
async def finalize(req):
    """
    Finalize an index by setting `ready` to `True` and update associated OTU's `last_indexed_version` field.

    """
    db = req.app["db"]
    pg = req.app["pg"]

    index_id = req.match_info["index_id"]

    index = await db.indexes.find_one(index_id)

    if index is None:
        return not_found("Index does not exist")

    ref_id = index["reference"]["id"]

    reference = await db.references.find_one(ref_id)

    if reference is None:
        return not_found("Reference associated with index does not exist")

    rows = await get_rows(pg, IndexFile, "index", index_id)

    results = {f.name: f.type for f in rows}

    if IndexType.fasta not in results.values():
        return conflict("A FASTA file must be uploaded in order to finalize index")

    if reference["data_type"] == "genome":
        required_files = [f for f in FILES if f != "reference.json.gz"]

        if missing_files := [f for f in required_files if f not in results]:
            return conflict(
                f"Reference requires that all Bowtie2 index files have been uploaded. "
                f"Missing files: {', '.join(missing_files)}")

    document = await virtool.indexes.db.finalize(db, pg, ref_id, index_id)

    return json_response(virtool.utils.base_processor(document))


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
        db_query.update(compose_regex_query(term, ["otu.name", "user.id"]))

    data = await paginate(
        db.history,
        db_query,
        req.query,
        sort=[("otu.name", 1), ("otu.version", -1)],
        projection=LIST_PROJECTION,
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

    raise HTTPNoContent
