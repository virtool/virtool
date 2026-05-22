from collections.abc import AsyncIterator
from typing import Any

from aiohttp import BodyPartReader, MultipartReader
from aiohttp.web import Request
from structlog import get_logger

from virtool.api.custom_json import json_response, loads
from virtool.api.errors import APIBadRequest, APINotFound
from virtool.api.routes import Routes
from virtool.api.streaming import stream_storage_response
from virtool.caches.models import Cache
from virtool.data.errors import CacheAlreadyExistsError, CacheMissError
from virtool.data.utils import get_data_from_req
from virtool.uploads.utils import CHUNK_SIZE

logger = get_logger("caches")
routes = Routes()


async def _part_chunker(
    part: BodyPartReader,
    reader: MultipartReader,
) -> AsyncIterator[bytes]:
    while chunk := await part.read_chunk(CHUNK_SIZE):
        yield chunk

    while trailing_part := await reader.next():
        if trailing_part.name in {"cache_type", "parent_id"}:
            raise APIBadRequest()


def _metadata(cache: Cache) -> dict[str, Any]:
    return cache.dict(
        include={
            "id",
            "key",
            "params",
            "size",
            "created_at",
            "last_accessed_at",
        },
    )


async def _read_params(part: BodyPartReader) -> dict[str, Any]:
    try:
        params = loads(await part.read(decode=True))
    except ValueError:
        raise APIBadRequest()

    if not isinstance(params, dict):
        raise APIBadRequest()

    return params


async def _read_upload(req: Request) -> tuple[dict[str, Any], AsyncIterator[bytes]]:
    try:
        reader = await req.multipart()
    except (AssertionError, ValueError):
        raise APIBadRequest()

    params = None

    while part := await reader.next():
        if part.name == "params":
            params = await _read_params(part)
            continue

        if part.name == "blob":
            if params is None:
                raise APIBadRequest()

            return params, _part_chunker(part, reader)

        if part.name in {"cache_type", "parent_id"}:
            raise APIBadRequest()

    raise APIBadRequest()


@routes.jobs_api.get("/caches/{key}")
async def get_cache(req: Request):
    key = req.match_info["key"]

    try:
        hit = await get_data_from_req(req).caches.get(key)
    except CacheMissError:
        logger.info("cache miss", key=key)
        raise APINotFound()

    logger.info("cache hit", key=key)

    return json_response(_metadata(hit))


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
    params, chunker = await _read_upload(req)

    try:
        created = await get_data_from_req(req).caches.create(chunker, key, params)
    except CacheAlreadyExistsError:
        logger.info("cache put race", key=key)

        try:
            hit = await get_data_from_req(req).caches.get(key)
        except CacheMissError:
            raise APINotFound()

        return json_response(_metadata(hit))

    logger.info("cache put", key=key, size=created.size)

    return json_response(_metadata(created), status=201)
