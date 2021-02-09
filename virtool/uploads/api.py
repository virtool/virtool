import asyncio
import logging
import os
from pathlib import Path

import aiofiles
import aiohttp.web
from cerberus import Validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import virtool.db.utils
import virtool.files.db
import virtool.http.routes
import virtool.samples.db
import virtool.uploads.db
import virtool.utils
from virtool.api.response import invalid_query, json_response, bad_request, not_found
from virtool.uploads.models import Upload

logger = logging.getLogger("uploads")

CHUNK_SIZE = 4096

UPLOAD_TYPES = [
    "hmm",
    "reference",
    "reads",
    "subtraction",
    None
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


@routes.post("/api/uploads", permission="upload_file")
async def upload(req):
    db = req.app["postgres"]
    upload_type = req.query.get("type")

    errors = naive_validator(req)

    if errors:
        return invalid_query(errors)

    name = req.query["name"]

    if upload_type not in UPLOAD_TYPES:
        return bad_request("Unsupported upload type")

    upload_ = await virtool.uploads.db.create(db, name, upload_type, user=req["client"].user_id)

    upload_id = upload_["id"]

    async with AsyncSession(db) as session:
        try:
            result = (await session.execute(select(Upload).filter_by(id=upload_id))).scalar()
            size, uploaded_at = await naive_writer(req, upload_id, name)

            result.size = size
            result.name_on_disk = f"{upload_id}-{name}"
            result.uploaded_at = uploaded_at

            await session.commit()

            upload_.update({
                "size": size,
                "name_on_disk": f"{upload_id}-{name}",
                "uploaded_at": uploaded_at
            })

            logger.debug(f"Upload succeeded: {upload_id}")

            headers = {
                "Location": f"/api/uploads/{upload_id}"
            }

            return json_response(upload_, status=201, headers=headers)
        except asyncio.CancelledError:
            logger.debug(f"Upload aborted: {upload_id}")

            await session.delete(result)
            await session.commit()

            return aiohttp.web.Response(status=499)


@routes.get("/api/uploads")
async def find(req):
    db = req.app["postgres"]
    upload_ = list()
    filters = list()
    user = req.query.get("user")
    type_ = req.query["type"]

    if user:
        filters.append(Upload.user == user)

    if type_:
        filters.append(Upload.type == type_)

    async with AsyncSession(db) as session:
        query = select(Upload)

        if filters:
            query.filter(*filters)

        results = session.execute(query)

        for result in results.scalars().all():
            upload_.append(result.to_dict())

    resp = json_response(upload_)

    return resp


@routes.get("/api/uploads/{id}")
async def get(req):
    db = req.app["postgres"]
    upload_id = int(req.match_info["id"])

    async with AsyncSession(db) as session:
        result = (await session.execute(select(Upload).filter_by(id=upload_id))).scalar()

        if not result:
            return not_found("Upload record not found")

    # check if the file has been removed as a result of a `DELETE` request
    if result.removed:
        return not_found("Uploaded file has already been removed")

    upload_path = Path(req.app["settings"]["data_path"]) / "files" / result.name_on_disk

    # check if the file has been manually removed by the user
    if not upload_path.exists():
        return not_found("Uploaded file not found at expected location")

    return aiohttp.web.FileResponse(upload_path)


@routes.delete("/api/uploads/{id}", permission="remove_file")
async def delete(req):
    db = req.app["postgres"]
    upload_id = int(req.match_info["id"])

    async with AsyncSession(db) as session:
        result = (await session.execute(select(Upload).where(Upload.id == upload_id))).scalar()

        if not result:
            return not_found("Upload record not found")

        if result.removed:
            return bad_request("Uploaded file has already been removed")

        try:
            await req.app["run_in_thread"](
                os.remove,
                Path(req.app["settings"]["data_path"]) / "files" / result.name_on_disk
            )
        except FileNotFoundError:
            pass

        result.removed = True
        result.removed_at = virtool.utils.timestamp()

        await session.commit()

    return aiohttp.web.Response(status=204)
