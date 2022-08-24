import asyncio
import json
import logging

from aiohttp.web import FileResponse, Request, Response
from aiohttp.web_exceptions import HTTPBadRequest, HTTPConflict, HTTPNoContent
from sqlalchemy.exc import IntegrityError

import virtool.indexes.db
import virtool.references.db
import virtool.uploads.db
import virtool.utils
from virtool.api.json import CustomEncoder
from virtool.api.response import InsufficientRights, NotFound, json_response
from virtool.api.utils import compose_regex_query, paginate
from virtool.data.utils import get_data_from_req
from virtool.history.db import LIST_PROJECTION
from virtool.http.routes import Routes
from virtool.indexes.db import FILES, reset_history
from virtool.indexes.files import create_index_file
from virtool.indexes.models import IndexFile, IndexType
from virtool.indexes.utils import check_index_file_type, join_index_path
from virtool.jobs.utils import JobRights
from virtool.mongo.utils import get_new_id
from virtool.pg.utils import delete_row, get_rows
from virtool.references.db import check_right
from virtool.uploads.utils import naive_writer
from virtool.utils import compress_json_with_gzip, run_in_thread

logger = logging.getLogger("indexes")
routes = Routes()


@routes.get("/indexes")
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
        {"$match": {"ready": True}},
        {"$sort": {"version": -1}},
        {
            "$group": {
                "_id": "$reference.id",
                "index": {"$first": "$_id"},
                "version": {"$first": "$version"},
            }
        },
    ]

    ready_indexes = []

    async for agg in db.indexes.aggregate(pipeline):
        reference = await db.references.find_one(agg["_id"], ["data_type", "name"])

        ready_indexes.append(
            {
                "id": agg["index"],
                "version": agg["version"],
                "reference": {
                    "id": agg["_id"],
                    "name": reference["name"],
                    "data_type": reference["data_type"],
                },
            }
        )

    return json_response(ready_indexes)


@routes.get("/indexes/{index_id}")
@routes.jobs_api.get("/indexes/{index_id}")
async def get(req):
    """
    Get the complete document for a given index.

    """
    db = req.app["db"]
    pg = req.app["pg"]

    index_id = req.match_info["index_id"]

    document = await db.indexes.find_one(index_id)

    if not document:
        raise NotFound()

    contributors, otus = await asyncio.gather(
        virtool.indexes.db.get_contributors(db, index_id),
        virtool.indexes.db.get_otus(db, index_id),
    )

    document.update(
        {
            "change_count": sum(v["change_count"] for v in otus),
            "contributors": contributors,
            "otus": otus,
        }
    )

    document = await virtool.indexes.db.attach_files(
        pg, req.app["config"].base_url, document
    )

    document = await virtool.indexes.db.processor(db, document)

    return json_response(document)


@routes.jobs_api.get("/indexes/{index_id}/files/otus.json.gz")
async def download_otus_json(req):
    """
    Download a complete compressed JSON representation of the index OTUs.

    """
    db = req.app["db"]
    index_id = req.match_info["index_id"]

    index = await db.indexes.find_one(index_id)

    if index is None:
        raise NotFound()

    ref_id = index["reference"]["id"]

    json_path = (
        join_index_path(req.app["config"].data_path, ref_id, index_id) / "otus.json.gz"
    )

    if not json_path.exists():
        patched_otus = await virtool.indexes.db.get_patched_otus(
            db, req.app["config"], index["manifest"]
        )

        json_string = json.dumps(patched_otus, cls=CustomEncoder)

        await run_in_thread(compress_json_with_gzip, json_string, json_path)

    return FileResponse(
        json_path,
        headers={
            "Content-Disposition": "attachment; filename=otus.json.gz",
            "Content-Type": "application/octet-stream",
        },
    )


@routes.get("/indexes/{index_id}/files/{filename}")
async def download_index_file(req: Request):
    """
    Download files relating to a given index.
    """
    index_id = req.match_info["index_id"]
    filename = req.match_info["filename"]

    if filename not in FILES:
        raise NotFound()

    index_document = await req.app["db"].indexes.find_one(index_id)

    if index_document is None:
        raise NotFound()

    # check the requesting user has read access to the parent reference
    if not await check_right(req, index_document["reference"], "read"):
        raise InsufficientRights()

    reference_id = index_document["reference"]["id"]

    path = (
        join_index_path(req.app["config"].data_path, reference_id, index_id) / filename
    )

    if not path.exists():
        raise NotFound("File not found")

    return FileResponse(
        path,
        headers={
            "Content-Disposition": f"attachment; filename={filename}",
            "Content-Type": "application/octet-stream",
        },
    )


@routes.jobs_api.get("/indexes/{index_id}/files/{filename}")
async def download_index_file_for_jobs(req: Request):
    """Download files relating to a given index for jobs."""
    index_id = req.match_info["index_id"]
    filename = req.match_info["filename"]

    if filename not in FILES:
        raise NotFound()

    index_document = await req.app["db"].indexes.find_one(index_id)

    if index_document is None:
        raise NotFound()

    reference_id = index_document["reference"]["id"]

    path = (
        join_index_path(req.app["config"].data_path, reference_id, index_id) / filename
    )

    if not path.exists():
        raise NotFound("File not found")

    return FileResponse(path)


@routes.post("/refs/{ref_id}/indexes")
async def create(req):
    """
    Starts a job to rebuild the otus Bowtie2 index on disk.

    Does a check to make sure there are no unverified OTUs in the collection and updates
    otu history to show the version and id of the new index.

    """
    db = req.app["db"]

    ref_id = req.match_info["ref_id"]

    reference = await db.references.find_one(ref_id, ["groups", "users"])

    if reference is None:
        raise NotFound()

    if not await virtool.references.db.check_right(req, reference, "build"):
        raise InsufficientRights()

    if await db.indexes.count_documents(
        {"reference.id": ref_id, "ready": False}, limit=1
    ):
        raise HTTPConflict(text="Index build already in progress")

    if await db.otus.count_documents(
        {"reference.id": ref_id, "verified": False}, limit=1
    ):
        raise HTTPBadRequest(text="There are unverified OTUs")

    if not await db.history.count_documents(
        {"reference.id": ref_id, "index.id": "unbuilt"}, limit=1
    ):
        raise HTTPBadRequest(text="There are no unbuilt changes")

    user_id = req["client"].user_id

    job_id = await get_new_id(db.jobs)

    document = await virtool.indexes.db.create(db, ref_id, user_id, job_id)

    rights = JobRights()
    rights.indexes.can_modify(document["_id"])
    rights.references.can_read(ref_id)

    await get_data_from_req(req).jobs.create(
        "build_index",
        {
            "ref_id": ref_id,
            "user_id": user_id,
            "index_id": document["_id"],
            "index_version": document["version"],
            "manifest": document["manifest"],
        },
        user_id,
        rights,
        job_id=job_id,
    )

    headers = {"Location": f"/indexes/{document['_id']}"}

    return json_response(
        await virtool.indexes.db.processor(db, document), status=201, headers=headers
    )


@routes.jobs_api.put("/indexes/{index_id}/files/{filename}")
async def upload(req):
    """Upload a new index file."""
    db = req.app["db"]
    pg = req.app["pg"]
    index_id = req.match_info["index_id"]
    name = req.match_info["filename"]

    if name not in FILES:
        raise NotFound("Index file not found")

    document = await db.indexes.find_one(index_id)

    if document is None:
        raise NotFound()

    reference_id = document["reference"]["id"]
    file_type = check_index_file_type(name)

    try:
        index_file = await create_index_file(pg, index_id, file_type, name)
    except IntegrityError:
        raise HTTPConflict(text="File name already exists")

    upload_id = index_file["id"]

    path = join_index_path(req.app["config"].data_path, reference_id, index_id) / name

    try:
        size = await naive_writer(req, path)
    except asyncio.CancelledError:
        logger.debug(f"Index file upload aborted: {upload_id}")
        await delete_row(pg, upload_id, IndexFile)
        return Response(status=499)

    index_file = await virtool.uploads.db.finalize(pg, size, upload_id, IndexFile)

    headers = {"Location": f"/indexes/{index_id}/files/{name}"}

    index_file["uploaded_at"] = virtool.utils.timestamp()

    return json_response(index_file, headers=headers, status=201)


@routes.jobs_api.patch("/indexes/{index_id}")
async def finalize(req):
    """
    Finalize an index.

    Sets the `ready` flag and updates associated OTUs' `last_indexed_version` fields.

    """
    db = req.app["db"]
    pg = req.app["pg"]

    index_id = req.match_info["index_id"]

    index = await db.indexes.find_one(index_id)

    if index is None:
        raise NotFound("Index does not exist")

    ref_id = index["reference"]["id"]

    reference = await db.references.find_one(ref_id)

    if reference is None:
        raise NotFound("Reference associated with index does not exist")

    rows = await get_rows(pg, IndexFile, "index", index_id)

    results = {f.name: f.type for f in rows}

    if IndexType.fasta not in results.values():
        raise HTTPConflict(
            text="A FASTA file must be uploaded in order to finalize index"
        )

    if reference["data_type"] == "genome":
        required_files = [f for f in FILES if f != "reference.json.gz"]

        if missing_files := [f for f in required_files if f not in results]:
            raise HTTPConflict(
                text=f"Reference requires that all Bowtie2 index files have been uploaded. "
                f"Missing files: {', '.join(missing_files)}"
            )

    document = await virtool.indexes.db.finalize(
        db, pg, req.app["config"].base_url, ref_id, index_id
    )

    return json_response(await virtool.indexes.db.processor(db, document))


@routes.get("/indexes/{index_id}/history")
async def find_history(req):
    """
    Find history changes for a specific index.

    """
    db = req.app["db"]

    index_id = req.match_info["index_id"]

    if not await db.indexes.count_documents({"_id": index_id}):
        raise NotFound()

    term = req.query.get("term")

    db_query = {"index.id": index_id}

    if term:
        db_query.update(compose_regex_query(term, ["otu.name", "user.id"]))

    data = await paginate(
        db.history,
        db_query,
        req.query,
        sort=[("otu.name", 1), ("otu.version", -1)],
        projection=LIST_PROJECTION,
        reverse=True,
    )

    return json_response(data)


@routes.jobs_api.delete("/indexes/{index_id}")
async def delete_index(req: Request):
    """Delete the index with the given id and reset history relating to that index."""
    index_id = req.match_info["index_id"]
    db = req.app["db"]

    delete_result = await db.indexes.delete_one({"_id": index_id})

    if delete_result.deleted_count != 1:
        # Document could not be deleted.
        raise NotFound(f"There is no index with id: {index_id}.")

    await reset_history(db, index_id)

    raise HTTPNoContent
