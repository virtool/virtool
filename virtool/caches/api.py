import virtool.analyses.utils
import virtool.caches.db
import virtool.users.db
import virtool.db.utils
import virtool.http.routes
import virtool.validators
import virtool.utils
from virtool.api.response import json_response, not_found

routes = virtool.http.routes.Routes()


@routes.get("/api/caches/{cache_id}")
async def get(req):
    """
    Return the complete representation for the cache with the given `cache_id`.

    """
    db = req.app["db"]
    cache_id = req.match_info["cache_id"]

    cache = await virtool.caches.db.get(db, cache_id)

    if cache is None:
        return not_found()

    return json_response(cache)
