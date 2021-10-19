from asyncio import CancelledError
from logging import getLogger
from pathlib import Path

from aiohttp.web_exceptions import HTTPBadRequest
from aiohttp.web_fileresponse import FileResponse
from aiohttp.web_response import Response

import virtool.uploads.db
from virtool.api.response import json_response, NotFound, InvalidQuery
from virtool.http.routes import Routes
from virtool.uploads.models import Upload, UploadType
from virtool.uploads.utils import naive_validator, naive_writer

logger = getLogger(__name__)

routes = Routes()


@routes.post("/api/uploads", permission="upload_file")
async def create(req):
    """
    Upload a new file and add it to the `uploads` SQL table.

    """
    pg = req.app["pg"]
    upload_type = req.query.get("type")

    errors = naive_validator(req)

    if errors:
        raise InvalidQuery(errors)

    name = req.query["name"]

    if upload_type and upload_type not in UploadType.to_list():
        raise HTTPBadRequest(text="Unsupported upload type")

    upload = await virtool.uploads.db.create(pg, name, upload_type, user=req["client"].user_id)

    upload_id = upload["id"]

    file_path = req.app["settings"]["data_path"] / "files" / upload["name_on_disk"]

    try:
        size = await naive_writer(req, file_path)

        upload = await virtool.uploads.db.finalize(
            pg,
            size,
            upload_id,
            Upload
        )
    except CancelledError:
        logger.debug(f"Upload aborted: {upload_id}")

        await virtool.uploads.db.delete(
            req,
            pg,
            upload_id
        )

        return Response(status=499)

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
        raise NotFound()

    # check if the file has been removed as a result of a `DELETE` request

    upload_path = Path(req.app["settings"]["data_path"]) / "files" / upload.name_on_disk

    # check if the file has been manually removed by the user
    if not upload_path.exists():
        raise NotFound("Uploaded file not found at expected location")

    return FileResponse(upload_path)


@routes.delete("/api/uploads/{id}", permission="remove_file")
async def delete(req):
    """
    Set a row's `removed` and `removed_at` attribute in the `uploads` SQL table and delete its associated local file.

    """
    pg = req.app["pg"]
    upload_id = int(req.match_info["id"])

    upload = await virtool.uploads.db.delete(req, pg, upload_id)

    if not upload:
        raise NotFound()

    return Response(status=204)
