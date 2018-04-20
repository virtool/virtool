import os

import virtool.file
import virtool.utils
from virtool.handlers.utils import json_response, not_found, paginate, protected


async def find(req):
    db = req.app["db"]

    base_query = {
        "ready": True,
        "reserved": False
    }

    file_type = req.query.get("type", None)

    db_query = dict()

    if file_type:
        base_query["type"] = file_type

    data = await paginate(
        db.files,
        db_query,
        req.query,
        sort="uploaded_at",
        projection=virtool.file.PROJECTION,
        base_query=base_query
    )

    return json_response(data)


@protected("remove_file")
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
