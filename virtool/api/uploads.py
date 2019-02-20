import os

from cerberus import Validator

import virtool.db.files
import virtool.http.routes
import virtool.utils
from virtool.api.utils import invalid_query, json_response, not_found

CHUNK_SIZE = 131072

FILE_TYPES = [
    "reference",
    "reads",
    "hmm",
    "subtraction"
]

routes = virtool.http.routes.Routes()


@routes.post("/upload/{file_type}", permission="upload_file")
async def upload(req):
    file_type = req.match_info["file_type"]

    if file_type not in FILE_TYPES:
        return not_found()

    v = Validator({
        "name": {"type": "string", "required": True}
    }, allow_unknown=True)

    if not v.validate(dict(req.query)):
        return invalid_query(v.errors)

    reader = await req.multipart()
    file = await reader.next()

    db = req.app["db"]

    filename = req.query["name"]

    document = await virtool.db.files.create(
        db,
        filename,
        file_type,
        req["client"].user_id
    )

    file_path = os.path.join(req.app["settings"]["data_path"], "files", document["id"])

    size = 0

    with open(file_path, "wb") as handle:
        while True:
            chunk = await file.read_chunk(CHUNK_SIZE)
            if not chunk:
                break
            size += len(chunk)
            handle.write(chunk)

    return json_response(document, status=201)
