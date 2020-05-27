import logging
import os

import aiofiles
from cerberus import Validator

import virtool.db.utils
import virtool.files.db
import virtool.http.routes
import virtool.samples.db
import virtool.utils
from virtool.api.response import invalid_query, json_response, not_found

CHUNK_SIZE = 4096

FILE_TYPES = [
    "reference",
    "reads",
    "hmm",
    "subtraction"
]

logger = logging.getLogger("uploads")

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

    size = await naive_writer(req, file_id)

    await db.files.update_one({"_id": file_id}, {
        "$set": {
            "size": size,
            "ready": True
        }
    })

    headers = {
        "Location": f"/api/files/{file_id}"
    }

    return json_response(document, status=201, headers=headers)


@routes.post("/upload/samples/{sample_id}/files/{suffix}")
async def replace_sample_file(req):
    error_resp = naive_validator(req)

    if error_resp:
        return error_resp

    db = req.app["db"]

    filename = req.query["name"]

    sample_id = req.match_info["sample_id"]
    suffix = req.match_info["suffix"]

    index = int(suffix) - 1

    minimal = await db.samples.find_one(sample_id, ["paired"])

    if minimal is None:
        return not_found("Sample not found")

    if suffix != "1" and suffix != "2":
        return not_found("Invalid file suffix. Must be 1 or 2.")

    if suffix == "2" and not minimal.get("paired"):
        return not_found("Sample is not paired")

    document = await virtool.files.db.create(
        db,
        filename,
        "sample_replacement",
        user_id=req["client"].user_id,
        reserved=True
    )

    await naive_writer(req, document["id"])

    replacement = {
        "id": document["id"],
        "name": document["name"],
        "uploaded_at": document["uploaded_at"]
    }

    files = await virtool.db.utils.get_one_field(db.samples, "files", sample_id)

    files[index].update({
        "replacement": replacement
    })

    await db.samples.find_one_and_update({"_id": sample_id}, {
        "$set": {
            "files": files
        }
    })

    await virtool.samples.db.attempt_file_replacement(req.app, sample_id, req["client"].user_id)

    return json_response(document, status=201)
