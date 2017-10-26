import os
from cerberus import Validator

import virtool.file
import virtool.utils
from virtool.handlers.utils import json_response, not_found, invalid_query

FILE_TYPES = {
    "/upload/viruses": "viruses",
    "/upload/reads": "reads",
    "/upload/hmm/profiles": "profiles",
    "/upload/hmm/annotations": "annotations",
    "/upload/subtraction": "subtraction"
}


async def upload(req):
    try:
        file_type = FILE_TYPES[req.path]
    except KeyError:
        return not_found()

    v = Validator({
        "name": {"type": "string", "required": True}
    })

    if not v(dict(req.query)):
        return invalid_query(v.errors)

    reader = await req.multipart()
    file = await reader.next()

    db = req.app["db"]

    filename = req.query["name"]

    document = await virtool.file.create(
        db,
        req.app["dispatcher"].dispatch,
        filename,
        file_type,
        req["client"].user_id
    )

    file_path = os.path.join(req.app["settings"].get("data_path"), "files", document["id"])

    size = 0

    with open(file_path, "wb") as handle:
        while True:
            chunk = await file.read_chunk()
            if not chunk:
                break
            size += len(chunk)
            handle.write(chunk)

    return json_response(document)
