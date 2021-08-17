from aiohttp.web import HTTPNoContent, HTTPNotFound

import virtool.history.db
import virtool.http.routes
import virtool.references.db
from virtool.api.response import conflict, json_response, HTTPInsufficientRights
from virtool.errors import DatabaseError

routes = virtool.http.routes.Routes()


@routes.get("/api/history")
async def find(req):
    """
    Get a list of change documents.

    """
    db = req.app["db"]

    data = await virtool.history.db.find(db, req.query)

    return json_response(data)


@routes.get("/api/history/{change_id}")
async def get(req):
    """
    Get a specific change document by its ``change_id``.

    """
    change_id = req.match_info["change_id"]

    document = await virtool.history.db.get(req.app, change_id)

    if document:
        return json_response(document)

    raise HTTPNotFound(text="Not found")


@routes.delete("/api/history/{change_id}")
async def revert(req):
    """
    Remove the change document with the given ``change_id`` and any subsequent changes.

    """
    db = req.app["db"]

    change_id = req.match_info["change_id"]

    document = await db.history.find_one(change_id, ["reference"])

    if not document:
        raise HTTPNotFound(text="Not found")

    if not await virtool.references.db.check_right(req, document["reference"]["id"], "modify_otu"):
        raise HTTPInsufficientRights()

    try:
        await virtool.history.db.revert(req.app, change_id)
    except DatabaseError:
        return conflict("Change is already built")

    raise HTTPNoContent
