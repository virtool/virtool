import os
from aiohttp import web

import virtool.file
import virtool.utils
from virtool.handlers.utils import json_response

FILE_TYPES = {
    "/upload/viruses": "viruses",
    "/upload/reads": "reads",
    "/upload/hmm/profiles": "profiles",
    "/upload/hmm/annotations": "annotations",
    "/upload/host": "host"
}


async def upload(req):
    db = req.app["db"]

    try:
        file_type = FILE_TYPES[req.path]
    except KeyError:
        return web.Response(status=404)

    reader = await req.multipart()
    file = await reader.next()

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

    print(file_path)

    with open(file_path, "wb") as handle:
        while True:
            chunk = await file.read_chunk()
            if not chunk:
                break
            size += len(chunk)
            handle.write(chunk)

    return json_response(document)
