from aiohttp.web import Request
from structlog import get_logger

from virtool.api.custom_json import json_response
from virtool.api.errors import APINotFound
from virtool.api.routes import Routes
from virtool.api.streaming import stream_storage_response
from virtool.caches.api_utils import (
    cache_body_chunker,
    cache_metadata,
    read_cache_content_length,
    read_cache_params,
)
from virtool.config import get_config_from_req
from virtool.data.errors import CacheAlreadyExistsError, CacheMissError
from virtool.data.utils import get_data_from_req

logger = get_logger("caches")
routes = Routes()


@routes.jobs_api.get("/caches/{key}")
async def get_cache(req: Request):
    key = req.match_info["key"]

    try:
        hit = await get_data_from_req(req).caches.get(key)
    except CacheMissError:
        logger.info("cache miss", key=key)
        raise APINotFound()

    logger.info("cache hit", key=key)

    return json_response(cache_metadata(hit))


@routes.jobs_api.get("/caches/{key}/blob")
async def get_cache_blob(req: Request):
    key = req.match_info["key"]

    try:
        hit = await get_data_from_req(req).caches.get(key)
    except CacheMissError:
        logger.info("cache miss", key=key)
        raise APINotFound()

    logger.info("cache hit", key=key)

    return await stream_storage_response(
        req,
        hit.data,
        {
            "Content-Length": str(hit.size),
            "Content-Type": "application/octet-stream",
        },
        not_found_message="Not found",
    )


@routes.jobs_api.put("/caches/{key}")
async def put_cache(req: Request):
    key = req.match_info["key"]
    params = read_cache_params(req)
    max_size = get_config_from_req(req).cache_max_size
    content_length = read_cache_content_length(req, max_size)

    try:
        created = await get_data_from_req(req).caches.create(
            cache_body_chunker(req, content_length, max_size),
            key,
            params,
        )
    except CacheAlreadyExistsError:
        logger.info("cache put race", key=key)

        try:
            hit = await get_data_from_req(req).caches.get(key)
        except CacheMissError:
            raise APINotFound()

        return json_response(cache_metadata(hit))

    logger.info("cache put", key=key, size=created.size)

    return json_response(cache_metadata(created), status=201)
