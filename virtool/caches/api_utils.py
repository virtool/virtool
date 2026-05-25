from typing import Any

from aiohttp.web import Request

from virtool.api.custom_json import loads
from virtool.api.errors import APIBadRequest
from virtool.caches.models import Cache


def cache_metadata(cache: Cache) -> dict[str, Any]:
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


def read_cache_params(req: Request) -> dict[str, Any] | None:
    value = req.query.get("params")

    if value is None:
        return None

    try:
        params = loads(value)
    except ValueError:
        raise APIBadRequest()

    if params is None:
        return None

    if not isinstance(params, dict):
        raise APIBadRequest()

    return params
