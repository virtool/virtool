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

    file_id = "{}-{}".format(await virtool.utils.get_new_id(db.files), filename)

    while file_id in await db.files.distinct("_id"):
        file_id = "{}-{}".format(await virtool.utils.get_new_id(db.files), filename)

    file_path = os.path.join(req.app["settings"].get("data_path"), "files", file_id)

    document = {
        "_id": file_id,
        "name": filename,
        "type": file_type,
        "user": {
            "id": req["session"].user_id
        },
        "uploaded_at": virtool.utils.timestamp(),
        "created": False,
        "ready": False
    }

    await db.files.insert_one(document)

    document = {key: document[key] for key in virtool.file.LIST_PROJECTION if document.get(key, False)}

    document = virtool.file.processor(document)

    await req.app["dispatcher"].dispatch(
        "files",
        "update",
        document
    )

    size = 0

    with open(file_path, "wb") as handle:
        while True:
            chunk = await file.read_chunk()
            if not chunk:
                break
            size += len(chunk)
            handle.write(chunk)

    return json_response(document)
