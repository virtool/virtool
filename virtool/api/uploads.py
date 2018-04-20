import os

from cerberus import Validator

import virtool.db.files
import virtool.utils
from virtool.api.utils import invalid_query, json_response, not_found, protected

FILE_TYPES = {
    "/upload/kinds": "kinds",
    "/upload/reads": "reads",
    "/upload/hmm/profiles": "profiles",
    "/upload/hmm/annotations": "annotations",
    "/upload/subtraction": "subtraction"
}


@protected("upload_file")
async def upload(req):
    try:
        file_type = FILE_TYPES[req.path]
    except KeyError:
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

    return json_response(document, status=201)
