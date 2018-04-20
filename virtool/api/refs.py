import virtool.db.history
import virtool.utils
from virtool.api.utils import json_response


async def get_unbuilt_changes(req):
    """
    Get a JSON document describing the unbuilt changes that could be used to create a new index.

    """
    db = req.app["db"]

    ref_id = req.match_info["ref_id"]

    history = await db.history.find({
        "ref.id": ref_id,
        "index.id": "unbuilt"
    }, virtool.db.history.LIST_PROJECTION).to_list(None)

    return json_response({
        "history": [virtool.utils.base_processor(c) for c in history]
    })


async def create_
