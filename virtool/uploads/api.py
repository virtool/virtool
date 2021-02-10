import asyncio
import logging
import os
from pathlib import Path

import aiohttp.web

import virtool.db.utils
import virtool.files.db
import virtool.http.routes
import virtool.samples.db
import virtool.uploads.db
import virtool.uploads.utils
import virtool.utils
from virtool.api.response import invalid_query, json_response, bad_request, not_found
from virtool.uploads.models import Upload

logger = logging.getLogger("uploads")

UPLOAD_TYPES = [
    "hmm",
    "reference",
    "reads",
    "subtraction",
    None
]

routes = virtool.http.routes.Routes()


@routes.post("/api/uploads", permission="upload_file")
async def create(req):
    """
    Upload a new file and add it to the `uploads` SQL table.

    """
    pg = req.app["postgres"]
    upload_type = req.query.get("type")

    errors = virtool.uploads.utils.naive_validator(req)

    if errors:
        return invalid_query(errors)

    name = req.query["name"]

    if upload_type not in UPLOAD_TYPES:
        return bad_request("Unsupported upload type")

    upload = await virtool.uploads.db.create(pg, name, upload_type, user=req["client"].user_id)

    upload_id = upload["id"]

    file_path = Path(req.app["settings"]["data_path"]) / "files" / upload["name_on_disk"]

    try:
        size = await virtool.uploads.utils.naive_writer(req, file_path)
    except asyncio.CancelledError:
        logger.debug(f"Upload aborted: {upload_id}")
        # need to remove from table

        return aiohttp.web.Response(status=499)

    upload = await virtool.uploads.db.finalize(pg, size, upload_id, virtool.utils.timestamp())

    if not upload:
        await req.app["run_in_thread"](os.remove, file_path)
        # need to remove from table
        return not_found("Document not found in table after file upload")

    logger.debug(f"Upload succeeded: {upload_id}")

    headers = {
        "Location": f"/api/uploads/{upload_id}"
    }

    return json_response(upload, status=201, headers=headers)


@routes.get("/api/uploads")
async def find(req):
    """
    Get a list of upload documents from the `uploads` SQL table.

    """
    pg = req.app["postgres"]
    filters = list()
    user = req.query.get("user")
    upload_type = req.query.get("type")

    if user:
        filters.append(Upload.user == user)

    if upload_type:
        filters.append(Upload.type == upload_type)

    uploads = await virtool.uploads.db.find(pg, filters)

    return json_response(uploads)


@routes.get("/api/uploads/{id}")
async def get(req):
    """
    Download a file.

    """
    pg = req.app["postgres"]
    upload_id = int(req.match_info["id"])

    upload = await virtool.uploads.db.get(pg, upload_id)

    if not upload:
        return not_found()

    # check if the file has been removed as a result of a `DELETE` request
    if upload.removed:
        return not_found()

    upload_path = Path(req.app["settings"]["data_path"]) / "files" / upload.name_on_disk

    # check if the file has been manually removed by the user
    if not upload_path.exists():
        return not_found("Uploaded file not found at expected location")

    return aiohttp.web.FileResponse(upload_path)


@routes.delete("/api/uploads/{id}", permission="remove_file")
async def delete(req):
    """
    Delete an upload.

    """
    pg = req.app["postgres"]
    upload_id = int(req.match_info["id"])

    upload = await virtool.uploads.db.delete(pg, upload_id)

    if not upload:
        return not_found()

    try:
        await req.app["run_in_thread"](
            os.remove,
            Path(req.app["settings"]["data_path"]) / "files" / upload["name_on_disk"]
        )
    except FileNotFoundError:
        pass

    return aiohttp.web.Response(status=204)
