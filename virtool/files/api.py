"""
Provides request handlers for managing and viewing files.

"""
import pymongo

import virtool.api.utils
import virtool.files.db
import virtool.http.routes
import virtool.utils
from virtool.api.response import json_response, not_found

routes = virtool.http.routes.Routes()


@routes.get("/api/files")
async def find(req):
    """
    Find files based on an optional text query that is matched against file names. Only ready, unreserved files are
    returned.

    """
    db = req.app["db"]

    base_query = {
        "reserved": False
    }

    file_type = req.query.get("type")

    db_query = dict()

    if file_type:
        base_query["type"] = file_type

    data = await virtool.api.utils.paginate(
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
    """
    Remove a file given its `file_id`.

    """
    file_id = req.match_info["file_id"]

    deleted_count = await virtool.files.db.remove(
        req.app["db"],
        req.app["settings"],
        req.app["run_in_thread"],
        file_id
    )

    if deleted_count == 0:
        return not_found()

    return json_response({
        "file_id": file_id,
        "removed": True
    })
