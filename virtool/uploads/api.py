import asyncio
import logging
import os
from pathlib import Path

import aiohttp.web
from aiohttp.web_exceptions import HTTPBadRequest

import virtool.db.utils
import virtool.http.routes
import virtool.samples.db
import virtool.uploads.db
import virtool.uploads.utils
import virtool.utils
from virtool.api.response import invalid_query, json_response, not_found
from virtool.uploads.models import Upload, UploadType

logger = logging.getLogger(__name__)

routes = virtool.http.routes.Routes()


@routes.post("/api/uploads", permission="upload_file")
async def create(req):
    """
    Upload a new file and add it to the `uploads` SQL table.

    """
    pg = req.app["pg"]
    upload_type = req.query.get("type")

    errors = virtool.uploads.utils.naive_validator(req)

    if errors:
        return invalid_query(errors)

    name = req.query["name"]

    if upload_type and upload_type not in UploadType.to_list():
        raise HTTPBadRequest(text="Unsupported upload type")

    upload = await virtool.uploads.db.create(pg, name, upload_type, user=req["client"].user_id)

    upload_id = upload["id"]

    file_path = req.app["settings"]["data_path"] / "files" / upload["name_on_disk"]

    try:
        size = await virtool.uploads.utils.naive_writer(req, file_path)
    except asyncio.CancelledError:
        logger.debug(f"Upload aborted: {upload_id}")
        await virtool.uploads.db.delete_row(pg, upload_id)

        return aiohttp.web.Response(status=499)

    upload = await virtool.uploads.db.finalize(pg, size, upload_id, Upload)

    if not upload:
        await req.app["run_in_thread"](os.remove, file_path)

        return not_found("Row not found in table after file upload")

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
    pg = req.app["pg"]
    user = req.query.get("user")
    upload_type = req.query.get("type")
    response = dict()

    uploads = await virtool.uploads.db.find(pg, user, upload_type)

    response["documents"] = uploads

    return json_response(response)


@routes.get("/api/uploads/{id}")
@routes.jobs_api.get("/api/uploads/{id}")
async def get(req):
    """
    Downloads a file that corresponds to a row `id` in the `uploads` SQL table.

    """
    pg = req.app["pg"]
    upload_id = int(req.match_info["id"])

    upload = await virtool.uploads.db.get(pg, upload_id)

    if not upload:
        return not_found()

    # check if the file has been removed as a result of a `DELETE` request

    upload_path = Path(req.app["settings"]["data_path"]) / "files" / upload.name_on_disk

    # check if the file has been manually removed by the user
    if not upload_path.exists():
        return not_found("Uploaded file not found at expected location")

    return aiohttp.web.FileResponse(upload_path)


@routes.delete("/api/uploads/{id}", permission="remove_file")
async def delete(req):
    """
    Set a row's `removed` and `removed_at` attribute in the `uploads` SQL table and delete its associated local file.

    """
    pg = req.app["pg"]
    upload_id = int(req.match_info["id"])

    upload = await virtool.uploads.db.delete(req, pg, upload_id)

    if not upload:
        return not_found()

    return aiohttp.web.Response(status=204)
