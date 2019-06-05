import virtool.analyses
import virtool.db.caches
import virtool.db.users
import virtool.db.utils
import virtool.http.routes
import virtool.validators
import virtool.utils
from virtool.api.utils import bad_request, json_response, no_content, not_found

routes = virtool.http.routes.Routes()


@routes.get("/api/caches/{cache_id}")
async def get(req):
    db = req.app["db"]
    cache_id = req.match_info["cache_id"]

    cache = await virtool.db.caches.get(db, cache_id)

    if cache is None:
        return not_found()

    return json_response(cache)
