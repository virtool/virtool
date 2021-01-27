import asyncio
import logging
import os

import aiofiles
import aiohttp.web
from cerberus import Validator

import virtool.db.utils
import virtool.files.db
import virtool.http.routes
import virtool.samples.db
import virtool.utils
from virtool.api.response import invalid_query, json_response, not_found

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


async def naive_writer(req, file_id):
    reader = await req.multipart()
    file = await reader.next()

    file_path = os.path.join(req.app["settings"]["data_path"], "files", file_id)

    size = 0

    async with aiofiles.open(file_path, "wb") as handle:
        while True:
            chunk = await file.read_chunk(CHUNK_SIZE)
            if not chunk:
                break
            size += len(chunk)
            await handle.write(chunk)

    return size


@routes.post("/upload/{file_type}", permission="upload_file")
async def upload(req):
    db = req.app["db"]

    file_type = req.match_info["file_type"]

    if file_type not in FILE_TYPES:
        return not_found()

    errors = naive_validator(req)

    if errors:
        return invalid_query(errors)

    filename = req.query["name"]

    document = await virtool.files.db.create(
        db,
        filename,
        file_type,
        user_id=req["client"].user_id
    )

    file_id = document["id"]

    try:
        size = await naive_writer(req, file_id)

        await db.files.update_one({"_id": file_id}, {
            "$set": {
                "size": size,
                "ready": True
            }
        })

        logger.debug(f"Upload succeeded: {file_id}")

        headers = {
            "Location": f"/api/files/{file_id}"
        }

        return json_response(document, status=201, headers=headers)
    except asyncio.CancelledError:
        logger.debug(f"Upload aborted: {file_id}")

        await virtool.files.db.remove(
            db,
            req.app["settings"],
            req.app["run_in_thread"],
            file_id
        )

        return aiohttp.web.Response(status=499)
