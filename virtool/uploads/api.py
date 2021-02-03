import asyncio
import logging
import os

import aiofiles
import aiohttp.web
from cerberus import Validator
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

import virtool.db.utils
import virtool.files.db
import virtool.http.routes
import virtool.samples.db
import virtool.uploads.db
import virtool.utils
from virtool.api.response import invalid_query, json_response, bad_request
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

    return size, virtool.utils.timestamp()


@routes.post("/upload/{file_type}", permission="upload_file")
async def upload(req):
    db = req.app["postgres"]
    file_type = req.match_info["file_type"]

    errors = naive_validator(req)

    if errors:
        return invalid_query(errors)

    name = req.query["name"]

    if file_type not in FILE_TYPES:
        return bad_request("Unsupported file type")

    try:
        document = await virtool.uploads.db.create(db, name, file_type, user=req["client"].user_id)
    except IntegrityError:
        return bad_request("File name already exists")

    upload_id = document["id"]

    async with AsyncSession(db) as session:
        try:
            upload = (await session.execute(select(Upload).filter_by(id=upload_id))).scalar()
            size, uploaded_at = await naive_writer(req, upload_id, name)

            upload.size = size
            upload.name_on_disk = f"{upload_id}-{name}"
            upload.uploaded_at = uploaded_at

            await session.commit()

            document.update({
                "size": size,
                "name_on_disk": f"{upload_id}-{name}",
                "uploaded_at": uploaded_at
            })

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
