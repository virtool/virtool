from typing import Any

from aiohttp.web import Response
from aiohttp_pydantic import PydanticView
from pydantic import Json
from structlog import get_logger

from virtool.api.errors import APINotFound
from virtool.api.routes import Routes
from virtool.api.streaming import stream_storage_response
from virtool.caches.utils import (
    cache_body_chunker,
    read_cache_content_length,
    validate_cache_params,
)
from virtool.data.errors import CacheAlreadyExistsError, CacheMissError
from virtool.data.utils import get_data_from_req

logger = get_logger("caches")
routes = Routes()


@routes.jobs_api.view("/caches/{key}")
class CacheView(PydanticView):
    async def get(self, key: str, /):
        try:
            hit = await get_data_from_req(self.request).caches.get(key)
        except CacheMissError:
            logger.info("cache miss", key=key)
            raise APINotFound()

        logger.info("cache hit", key=key)

        return await stream_storage_response(
            self.request,
            hit.data,
            {
                "Content-Length": str(hit.size),
                "Content-Type": "application/octet-stream",
            },
        )

    async def put(self, key: str, /, params: Json[Any] | None = None):
        params = validate_cache_params(params)
        content_length = read_cache_content_length(self.request)

        try:
            created = await get_data_from_req(self.request).caches.create(
                cache_body_chunker(self.request, content_length),
                key,
                params,
            )
        except CacheAlreadyExistsError:
            logger.info("cache upload skipped; key already exists", key=key)
            return Response(status=200)

        logger.info("cache put", key=key, size=created.size)

        return Response(status=201)
