"""
Provides request handlers for managing and viewing files.

"""
import os
import pymongo

import virtool.files.db
import virtool.http.routes
import virtool.utils
from virtool.api import json_response, not_found, paginate

routes = virtool.http.routes.Routes()


@routes.get("/api/files")
async def find(req):
    """
    Find files based on an optional text query that is matched against file names. Only ready, unreserved files are
    returned.

    """
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
        sort=[("uploaded_at", pymongo.DESCENDING)],
        projection=virtool.files.db.PROJECTION,
        base_query=base_query
    )

    return json_response(data)


@routes.delete("/api/files/{file_id}", permission="remove_file")
async def remove(req):
    file_id = req.match_info["file_id"]

    file_path = os.path.join(req.app["settings"]["data_path"], "files", file_id)

    delete_result = await req.app["db"].files.delete_one({"_id": file_id})

    virtool.utils.rm(file_path)

    if delete_result.deleted_count == 0:
        return not_found()

    return json_response({
        "file_id": file_id,
        "removed": True
    })
