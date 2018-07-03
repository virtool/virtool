import virtool.db.history
import virtool.db.references
import virtool.errors
import virtool.history
import virtool.http.routes
import virtool.otus
import virtool.utils
from virtool.api.utils import conflict, insufficient_rights, json_response, no_content, not_found

routes = virtool.http.routes.Routes()


@routes.get("/api/history")
async def find(req):
    """
    Get a list of change documents.

    """
    db = req.app["db"]

    data = await virtool.db.history.find(db, req.query)

    return json_response(data)


@routes.get("/api/history/{change_id}")
async def get(req):
    """
    Get a specific change document by its ``change_id``.

    """
    db = req.app["db"]

    change_id = req.match_info["change_id"]

    document = await db.history.find_one(change_id, virtool.db.history.PROJECTION)

    if document:
        return json_response(virtool.utils.base_processor(document))

    return not_found()


@routes.delete("/api/history/{change_id}")
async def revert(req):
    """
    Remove the change document with the given ``change_id`` and any subsequent changes.

    """
    db = req.app["db"]

    change_id = req.match_info["change_id"]

    document = await db.history.find_one(change_id, ["reference"])

    if not document:
        return not_found()

    if not await virtool.db.references.check_right(req, document["reference"]["id"], "modify_otu"):
        return insufficient_rights()

    try:
        await virtool.db.history.revert(db, change_id)
    except virtool.errors.DatabaseError:
        return conflict("Change is already built")

    return no_content()
