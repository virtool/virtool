import asyncio
import logging
import os

import aiohttp.web
from aiohttp.web_exceptions import HTTPNoContent, HTTPBadRequest, HTTPNotFound, HTTPConflict
from aiohttp.web_fileresponse import FileResponse
from sqlalchemy import select, exc
from sqlalchemy.ext.asyncio import AsyncSession

import virtool.http.routes
import virtool.jobs.db
import virtool.subtractions.db
import virtool.uploads.db
import virtool.validators
from virtool.api.response import json_response
from virtool.api.utils import get_query_bool, paginate, compose_regex_query
from virtool.db.utils import get_new_id
from virtool.http.schema import schema
from virtool.jobs.utils import JobRights
from virtool.pg.utils import get_row_by_id
from virtool.subtractions.db import attach_computed
from virtool.subtractions.files import create_subtraction_file, delete_subtraction_file
from virtool.subtractions.models import SubtractionFile
from virtool.subtractions.utils import FILES
from virtool.uploads.models import Upload
from virtool.uploads.utils import naive_writer
from virtool.utils import base_processor

logger = logging.getLogger("subtractions")

routes = virtool.http.routes.Routes()

BASE_QUERY = {
    "deleted": False
}


@routes.get("/api/subtractions")
async def find(req):
    db = req.app["db"]

    ready = get_query_bool(req, "ready")
    short = get_query_bool(req, "short")

    projection = ["name"] if short else virtool.subtractions.db.PROJECTION

    db_query = dict()

    term = req.query.get("find")

    if term:
        db_query = compose_regex_query(term, ["name", "nickname"])

    if short:
        documents = list()

        async for document in db.subtraction.find({**db_query, **BASE_QUERY}, ["name"]):
            documents.append(base_processor(document))

        return json_response(documents)

    if ready:
        db_query["ready"] = True

    data = await paginate(
        db.subtraction,
        db_query,
        req.query,
        base_query=BASE_QUERY,
        sort="_id",
        projection=projection
    )

    data.update({
        "ready_count": await db.subtraction.count_documents({"ready": True})
    })

    return json_response(data)


@routes.get("/api/subtractions/{subtraction_id}")
@routes.jobs_api.get("/api/subtractions/{subtraction_id}")
async def get(req):
    """
    Get a complete host document.

    """
    db = req.app["db"]

    subtraction_id = req.match_info["subtraction_id"]

    document = await db.subtraction.find_one(subtraction_id)

    if not document:
        raise HTTPNotFound(text="Not found")

    with_computed = await attach_computed(req.app, document)

    return json_response(base_processor(with_computed))


@routes.post("/api/subtractions", permission="modify_subtraction")
@schema({
    "name": {
        "type": "string",
        "coerce": virtool.validators.strip,
        "empty": False,
        "required": True
    },
    "nickname": {
        "type": "string",
        "coerce": virtool.validators.strip,
        "default": ""
    },
    "upload_id": {
        "type": "integer",
        "required": True
    }
})
async def create(req):
    """
    Add a new subtraction. Starts an :class:`.CreateSubtraction` job process.

    """
    db = req.app["db"]
    pg = req.app["pg"]
    data = req["data"]

    name = data["name"]
    nickname = data["nickname"]
    upload_id = data["upload_id"]

    file = await get_row_by_id(pg, Upload, upload_id)

    if file is None:
        raise HTTPBadRequest(text="File does not exist")

    filename = file.to_dict().get("name")

    user_id = req["client"].user_id

    document = await virtool.subtractions.db.create(
        db,
        user_id,
        filename,
        name,
        nickname,
        upload_id
    )

    subtraction_id = document["_id"]

    task_args = {
        "subtraction_id": subtraction_id,
        "files": [{
            "id": upload_id,
            "name": filename
        }]
    }

    rights = JobRights()

    rights.subtractions.can_read(subtraction_id)
    rights.subtractions.can_modify(subtraction_id)
    rights.subtractions.can_remove(subtraction_id)
    rights.uploads.can_read(upload_id)

    job_id = await get_new_id(db.jobs)

    await virtool.jobs.db.create(
        db,
        "create_subtraction",
        task_args,
        user_id,
        rights,
        job_id=job_id
    )

    await req.app["jobs"].enqueue(job_id)

    headers = {
        "Location": f"/api/subtraction/{subtraction_id}"
    }

    with_computed = await attach_computed(req.app, document)

    return json_response(base_processor(with_computed), headers=headers, status=201)


@routes.jobs_api.put("/api/subtractions/{subtraction_id}/files/{filename}")
async def upload(req):
    """
    Upload a new subtraction file to the `subtraction_files` SQL table and the `subtractions`
    folder in the Virtool data path.

    """
    db = req.app["db"]
    pg = req.app["pg"]

    subtraction_id = req.match_info["subtraction_id"]
    filename = req.match_info["filename"]

    document = await db.subtraction.find_one(subtraction_id)

    if document is None:
        raise HTTPNotFound(text="Not found")

    if filename not in FILES:
        raise HTTPNotFound(text="Unsupported subtraction file name")

    file_type = virtool.subtractions.utils.check_subtraction_file_type(filename)

    try:
        subtraction_file = await create_subtraction_file(
            pg,
            subtraction_id,
            file_type,
            filename
        )
    except exc.IntegrityError:
        raise HTTPConflict(text="File name already exists")

    upload_id = subtraction_file["id"]
    path = req.app["settings"]["data_path"] / "subtractions" / subtraction_id / filename

    try:
        size = await naive_writer(req, path)
    except asyncio.CancelledError:
        logger.debug(f"Subtraction file upload aborted: {upload_id}")
        await delete_subtraction_file(pg, upload_id)

        return aiohttp.web.Response(status=499)

    subtraction_file = await virtool.uploads.db.finalize(pg, size, upload_id, SubtractionFile)

    headers = {
        "Location": f"/api/subtractions/{subtraction_id}/files/{filename}"
    }

    return json_response(subtraction_file, headers=headers, status=201)


@routes.patch("/api/subtractions/{subtraction_id}", permission="modify_subtraction")
@schema({
    "name": {
        "type": "string",
        "coerce": virtool.validators.strip,
        "empty": False,
    },
    "nickname": {
        "type": "string",
        "coerce": virtool.validators.strip
    }
})
async def edit(req):
    """
    Updates the nickname for an existing subtraction.

    """
    db = req.app["db"]
    data = req["data"]

    subtraction_id = req.match_info["subtraction_id"]

    update = dict()

    try:
        update["name"] = data["name"]
    except KeyError:
        pass

    try:
        update["nickname"] = data["nickname"]
    except KeyError:
        pass

    document = await db.subtraction.find_one_and_update({"_id": subtraction_id}, {
        "$set": update
    })

    if document is None:
        raise HTTPNotFound(text="Not found")

    with_computed = await attach_computed(req.app, document)

    return json_response(base_processor(with_computed))


@routes.delete("/api/subtractions/{subtraction_id}", permission="modify_subtraction")
async def remove(req):
    subtraction_id = req.match_info["subtraction_id"]

    updated_count = await asyncio.shield(virtool.subtractions.db.delete(req.app, subtraction_id))

    if updated_count == 0:
        raise HTTPNotFound(text="Not found")

    raise HTTPNoContent


@routes.jobs_api.patch("/api/subtractions/{subtraction_id}")
@schema({
    "gc": {"type": "dict", "required": True},
    "count": {"type": "integer", "required": True}
})
async def finalize_subtraction(req: aiohttp.web.Request):
    """
    Sets the gc field for an subtraction and marks it as ready.

    """
    db = req.app["db"]
    pg = req.app["pg"]

    data = await req.json()
    subtraction_id = req.match_info["subtraction_id"]

    document = await db.subtraction.find_one(subtraction_id)

    if document is None:
        raise HTTPNotFound(text="Not found")

    if "ready" in document and document["ready"]:
        raise HTTPConflict(text="Subtraction has already been finalized")

    finalized = await virtool.subtractions.db.finalize(db, pg, subtraction_id, data["gc"], data["count"])
    with_computed = await attach_computed(req.app, finalized)

    return json_response(base_processor(with_computed))


@routes.jobs_api.delete("/api/subtractions/{subtraction_id}")
async def job_remove(req: aiohttp.web.Request):
    """
    Remove a subtraction document. Only usable in the Jobs API and when subtractions are
    unfinalized.

    """
    db = req.app["db"]
    subtraction_id = req.match_info["subtraction_id"]

    document = await db.subtraction.find_one(subtraction_id)

    if document is None:
        raise HTTPNotFound(text="Not found")

    if "ready" in document and document["ready"]:
        raise HTTPConflict(text="Only unfinalized subtractions can be deleted")

    await virtool.subtractions.db.delete(req.app, subtraction_id)

    raise HTTPNoContent


@routes.get("/api/subtractions/{subtraction_id}/files/{filename}")
@routes.jobs_api.get("/api/subtractions/{subtraction_id}/files/{filename}")
async def download_subtraction_files(req: aiohttp.web.Request):
    """
    Download a Bowtie2 index file or a FASTA file for the given subtraction.

    """
    db = req.app["db"]
    pg = req.app["pg"]
    subtraction_id = req.match_info["subtraction_id"]
    filename = req.match_info["filename"]

    document = await db.subtraction.find_one(subtraction_id)

    if document is None:
        raise HTTPNotFound(text="Not found")

    if filename not in FILES:
        raise HTTPBadRequest(text="Unsupported subtraction file name")

    async with AsyncSession(pg) as session:
        result = (await session.execute(
            select(SubtractionFile).filter_by(subtraction=subtraction_id, name=filename)
        )).scalar()

    if not result:
        raise HTTPNotFound(text="Not found")

    file = result.to_dict()

    file_path = (
        virtool.subtractions.utils.join_subtraction_path(req.app["settings"], subtraction_id)
        / filename
    )

    if not os.path.isfile(file_path):
        raise HTTPNotFound(text="Not found")

    return FileResponse(file_path, headers={
        "Content-Length": file["size"],
        "Content-Type": "application/gzip"
    })
