from asyncio import CancelledError
from logging import getLogger
from pathlib import Path

import virtool.uploads.db
from aiohttp.web_exceptions import HTTPBadRequest
from aiohttp.web_fileresponse import FileResponse
from aiohttp.web_response import Response
from virtool.api.response import InvalidQuery, NotFound, json_response
from virtool.http.routes import Routes
from virtool.uploads.models import Upload, UploadType
from virtool.uploads.utils import naive_validator, naive_writer
from virtool.users.db import attach_user, attach_users

logger = getLogger(__name__)

routes = Routes()


@routes.post("/uploads", permission="upload_file")
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

    upload = await virtool.uploads.db.create(
        pg, name, upload_type, user=req["client"].user_id
    )

    upload_id = upload["id"]

    file_path = req.app["config"].data_path / "files" / upload["name_on_disk"]

    try:
        size = await naive_writer(req, file_path)

        upload = await virtool.uploads.db.finalize(pg, size, upload_id, Upload)
    except CancelledError:
        logger.debug(f"Upload aborted: {upload_id}")

        await virtool.uploads.db.delete(req, pg, upload_id)

        return Response(status=499)

    logger.debug(f"Upload succeeded: {upload_id}")

    headers = {"Location": f"/uploads/{upload_id}"}

    return json_response(
        await attach_user(req.app["db"], upload), status=201, headers=headers
    )


@routes.get("/uploads")
async def find(req):
    """
    Get a list of upload documents from the `uploads` SQL table.

    """
    pg = req.app["pg"]
    user = req.query.get("user")
    upload_type = req.query.get("type")
    response = dict()

    uploads = await virtool.uploads.db.find(pg, user, upload_type)
    uploads = await attach_users(req.app["db"], uploads)

    return json_response({"documents": uploads})


@routes.get("/uploads/{id}")
@routes.jobs_api.get("/uploads/{id}")
async def download(req):
    """
    Downloads a file that corresponds to a row `id` in the `uploads` SQL table.

    """
    pg = req.app["pg"]

    upload_id = int(req.match_info["id"])

    upload = await virtool.uploads.db.get(pg, upload_id)

    if not upload:
        raise NotFound()

    upload_path = req.app["config"].data_path / "files" / upload.name_on_disk

    # check if the file has been manually removed by the user
    if not upload_path.exists():
        raise NotFound("Uploaded file not found at expected location")

    headers = {
        "Content-Disposition": f"attachment; filename={upload.name}",
        "Content-Type": "application/x-gzip",
    }

    return FileResponse(upload_path, headers=headers)


@routes.delete("/uploads/{id}", permission="remove_file")
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
