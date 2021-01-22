import asyncio
import logging
import os

import aiofiles
import aiohttp.web
from cerberus import Validator
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

import virtool.db.utils
import virtool.files.db
import virtool.http.routes
import virtool.samples.db
import virtool.utils
from virtool.api.response import invalid_query, json_response, not_found, bad_request
from virtool.uploads.models import Upload

logger = logging.getLogger("uploads")

CHUNK_SIZE = 4096

FILE_TYPES = [
    "reference",
    "reads",
    "hmm",
    "subtraction"
]

routes = virtool.http.routes.Routes()


def naive_validator(req):
    v = Validator({
        "name": {"type": "string", "required": True}
    }, allow_unknown=True)

    if not v.validate(dict(req.query)):
        return v.errors


async def naive_writer(req, upload_id, name):
    reader = await req.multipart()
    file = await reader.next()

    file_path = os.path.join(req.app["settings"]["data_path"], "files", f"{upload_id}-{name}")

    size = 0

    async with aiofiles.open(file_path, "wb") as handle:
        while True:
            chunk = await file.read_chunk(CHUNK_SIZE)
            if not chunk:
                break
            size += len(chunk)
            await handle.write(chunk)

    return size, file_path


@routes.post("/upload/{file_type}", permission="upload_file")
async def create(req):
    file_type = req.match_info["file_type"]

    if file_type not in FILE_TYPES:
        return not_found()

    errors = naive_validator(req)

    if errors:
        return invalid_query(errors)

    async with AsyncSession(req.app["postgres"]) as session:
        upload = Upload(
            created_at=virtool.utils.timestamp(),
            field=req["client"].user_id,
            name=req.query["name"],
            ready=False,
            removed=False,
            reserved=False,
            type=req.match_info["file_type"],
        )

        session.add(upload)

        try:
            await session.commit()
        except IntegrityError:
            await session.rollback()
            return bad_request("File name already exists")

        upload_id = upload.id

        try:
            size, name_on_disk = await naive_writer(req, upload_id, upload.name)

            upload.size = size
            upload.name_on_disk = name_on_disk
            upload.uploaded_at = virtool.utils.timestamp()

            await session.commit()

            document = {
                "created_at": upload.created_at,
                "field": upload.field,
                "name": upload.name,
                "name_on_disk": name_on_disk,
                "ready": upload.ready,
                "removed": upload.removed,
                "reserved": upload.reserved,
                "size": size,
                "type": upload.type,
                "uploaded_at": upload.uploaded_at
            }

            logger.debug(f"Upload succeeded: {upload_id}")

            headers = {
                "Location": f"/api/files/{upload_id}"
            }

            return json_response(document, status=201, headers=headers)
        except asyncio.CancelledError:
            logger.debug(f"Upload aborted: {upload_id}")

            await session.delete(upload)
            await session.commit()

            return aiohttp.web.Response(status=499)
