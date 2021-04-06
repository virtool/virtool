import asyncio
import logging
import os
from pathlib import Path

import aiohttp.web
from aiohttp.web_fileresponse import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import virtool.api.utils
import virtool.db.utils
import virtool.http.routes
import virtool.jobs.db
import virtool.pg.utils
import virtool.samples.utils
import virtool.subtractions.db
import virtool.subtractions.files
import virtool.subtractions.utils
import virtool.uploads.db
import virtool.uploads.utils
import virtool.utils
import virtool.validators
from virtool.api.response import (bad_request, conflict, invalid_query,
                                  json_response, no_content, not_found)
from virtool.http.schema import schema
from virtool.jobs.utils import JobRights
from virtool.subtractions.models import SubtractionFile
from virtool.subtractions.utils import FILES
from virtool.uploads.models import Upload

logger = logging.getLogger("subtractions")

routes = virtool.http.routes.Routes()

BASE_QUERY = {
    "deleted": False
}


@routes.get("/api/subtractions")
async def find(req):
    db = req.app["db"]

    ready = virtool.api.utils.get_query_bool(req, "ready")
    short = virtool.api.utils.get_query_bool(req, "short")

    projection = ["name"] if short else virtool.subtractions.db.PROJECTION

    db_query = dict()

    term = req.query.get("find")

    if term:
        db_query = virtool.api.utils.compose_regex_query(term, ["name", "nickname"])

    if short:
        documents = list()

        async for document in db.subtraction.find({**db_query, **BASE_QUERY}, ["name"]):
            documents.append(virtool.utils.base_processor(document))

        return json_response(documents)

    if ready:
        db_query["ready"] = True

    data = await virtool.api.utils.paginate(
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
    pg = req.app["pg"]

    subtraction_id = req.match_info["subtraction_id"]

    document = await db.subtraction.find_one(subtraction_id)

    if not document:
        return not_found()

    document["linked_samples"] = await virtool.subtractions.db.get_linked_samples(db, subtraction_id)
    document["files"] = await virtool.subtractions.utils.prepare_files_field(pg, subtraction_id)

    return json_response(virtool.utils.base_processor(document))


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

    file = await virtool.pg.utils.get_row(pg, upload_id, Upload)

    if file is None:
        return bad_request("File does not exist")

    filename = file.to_dict().get("name")

    user_id = req["client"].user_id

    document = await virtool.subtractions.db.create(db, user_id, filename, name, nickname, upload_id)

    subtraction_id = document["_id"]

    task_args = {
        "subtraction_id": subtraction_id,
        "upload_id": upload_id
    }

    rights = JobRights()

    rights.subtractions.can_read(subtraction_id)
    rights.subtractions.can_modify(subtraction_id)
    rights.subtractions.can_remove(subtraction_id)
    rights.uploads.can_read(upload_id)

    await virtool.jobs.db.create(
        db,
        "create_subtraction",
        task_args,
        user_id,
        rights,
        job_id=document["job"]["id"]
    )

    await req.app["jobs"].enqueue(document["job"]["id"])

    headers = {
        "Location": f"/api/subtraction/{subtraction_id}"
    }

    return json_response(virtool.utils.base_processor(document), headers=headers, status=201)


@routes.jobs_api.post("/api/subtractions/{subtraction_id}/files")
async def upload(req):
    """
    Upload a new subtraction file to the `subtraction_files` SQL table and the `subtractions` folder in the Virtool
    data path.

    """
    db = req.app["db"]
    pg = req.app["pg"]
    subtraction_id = req.match_info["subtraction_id"]

    errors = virtool.uploads.utils.naive_validator(req)

    if errors:
        return invalid_query(errors)

    document = await db.subtraction.find_one(subtraction_id)

    if document is None:
        return not_found()

    file_name = req.query.get("name")

    if file_name not in FILES:
        return bad_request("Unsupported subtraction file name")

    file_type = virtool.subtractions.utils.check_subtraction_file_type(file_name)
    subtraction_file = await virtool.subtractions.files.create_subtraction_file(pg, subtraction_id, file_type,
                                                                                file_name)
    upload_id = subtraction_file["id"]
    path = Path(req.app["settings"]["data_path"]) / "subtractions" / subtraction_id / file_name

    if upload_id in document.get("files", []):
        return bad_request("File name already exists")

    try:
        size = await virtool.uploads.utils.naive_writer(req, path)
    except asyncio.CancelledError:
        logger.debug(f"Subtraction file upload aborted: {upload_id}")
        await virtool.subtractions.files.delete_subtraction_file(pg, upload_id)

        return aiohttp.web.Response(status=499)

    subtraction_file = await virtool.uploads.db.finalize(pg, size, upload_id, SubtractionFile)

    await db.subtraction.find_one_and_update({"_id": subtraction_id}, {
        "$push": {
            "files": upload_id
        }
    })

    headers = {
        "Location": f"/api/subtractions/{subtraction_id}/files/{file_name}"
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
    pg = req.app["pg"]

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
        return not_found()

    document["linked_samples"] = await virtool.subtractions.db.get_linked_samples(db, subtraction_id)
    document["files"] = await virtool.subtractions.utils.prepare_files_field(pg, subtraction_id)

    return json_response(virtool.utils.base_processor(document))


@routes.delete("/api/subtractions/{subtraction_id}", permission="modify_subtraction")
async def remove(req):
    db = req.app["db"]
    settings = req.app["settings"]

    subtraction_id = req.match_info["subtraction_id"]

    updated_count = await asyncio.shield(virtool.subtractions.db.delete(req.app, subtraction_id))

    if updated_count == 0:
        return not_found()

    return no_content()


@routes.jobs_api.patch("/api/subtractions/{subtraction_id}")
@schema({"gc": {"type": "dict", "required": True}})
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
        return not_found()

    if "ready" in document and document["ready"]:
        return conflict("Subtraction has already been finalized")

    updated_document = await virtool.subtractions.db.finalize(db, pg, subtraction_id, data["gc"])

    return json_response(virtool.utils.base_processor(updated_document))


@routes.jobs_api.delete("/api/subtractions/{subtraction_id}")
async def job_remove(req: aiohttp.web.Request):
    """
    Remove a subtraction document. Only usable in the Jobs API and when subtractions are unfinalized.

    """
    db = req.app["db"]
    subtraction_id = req.match_info["subtraction_id"]

    document = await db.subtraction.find_one(subtraction_id)

    if document is None:
        return not_found()

    if "ready" in document and document["ready"]:
        return conflict("Only unfinalized subtractions can be deleted")

    await virtool.subtractions.db.delete(req.app, subtraction_id)

    return no_content()


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
        return virtool.api.response.not_found()

    if filename not in FILES:
        return bad_request("Unsupported subtraction file name")

    async with AsyncSession(pg) as session:
        result = (await session.execute(
            select(SubtractionFile).filter_by(subtraction=subtraction_id, name=filename)
        )).scalar()

    if not result:
        return not_found()

    file = result.to_dict()

    file_path = os.path.join(
        virtool.subtractions.utils.join_subtraction_path(req.app["settings"], subtraction_id),
        filename
    )

    if not os.path.isfile(file_path):
        return virtool.api.response.not_found()

    return FileResponse(file_path, headers={
        "Content-Length": file["size"],
        "Content-Type": "application/gzip"
    })
