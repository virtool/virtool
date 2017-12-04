import os

import virtool.file
import virtool.utils
from virtool.handlers.utils import json_response, not_found


async def find(req):
    db = req.app["db"]

    query = {
        "ready": True,
        "reserved": False
    }

    file_type = req.query.get("type", None)

    if file_type:
        query["type"] = file_type

    cursor = db.files.find(query, virtool.file.PROJECTION)

    found_count = await cursor.count()

    documents = [virtool.utils.base_processor(d) for d in await cursor.to_list(15)]

    return json_response({
        "documents": documents,
        "found_count": found_count
    })


async def remove(req):
    file_id = req.match_info["file_id"]

    file_path = os.path.join(req.app["settings"].get("data_path"), "files", file_id)

    delete_result = await req.app["db"].files.delete_one({"_id": file_id})

    virtool.utils.rm(file_path)

    if delete_result.deleted_count == 0:
        return not_found("Document does not exist")

    await req.app["dispatcher"].dispatch("files", "remove", [file_id])

    return json_response({
        "file_id": file_id,
        "removed": True
    })
