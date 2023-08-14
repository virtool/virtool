"""
API request handlers for sample caches.

"""
import aiohttp.web

import virtool.caches.db
from virtool.api.response import NotFound, json_response
from virtool.http.routes import Routes

routes = Routes()


@routes.get("/caches/{cache_id}")
@routes.jobs_api.get("/caches/{cache_id}")
async def get(req: aiohttp.web.Request) -> aiohttp.web.Response:
    """
    Return the complete representation for the cache with the given `cache_id`.
    
    """
    db = req.app["db"]
    cache_id = req.match_info["cache_id"]

    cache = await virtool.caches.db.get(db, cache_id)

    if cache is None:
        raise NotFound()

    return json_response(cache)
