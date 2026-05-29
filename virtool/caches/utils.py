"""Helpers for deriving and transferring cache entries.

The content-addressing helpers are offered to downstream consumers that want to
derive a stable cache key from a parameter dict. The caches data layer does not
call them; callers supply a precomputed key to
:meth:`virtool.caches.data.CachesData.get` and
:meth:`virtool.caches.data.CachesData.create`. There is no defined relationship
between a row's key and any params dict the caller may pass.
"""

import hashlib
import json
from collections.abc import AsyncIterator
from typing import Any

from aiohttp.web import Request

from virtool.api.errors import APIBadRequest, APIRequestEntityTooLarge
from virtool.storage.protocol import STORAGE_CHUNK_SIZE

CACHE_MAX_SIZE = 10 * 1024**3
"""Maximum cache payload size in bytes."""


def canonicalize_params(params: dict[str, Any]) -> str:
    """Serialize ``params`` to a stable, byte-identical string.

    Keys are sorted, separators are tight, and non-ASCII characters are
    escaped so the output is independent of platform locale. Values must be
    JSON-serializable.
    """
    return json.dumps(
        params,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=True,
    )


def derive_key(params: dict[str, Any]) -> str:
    """Derive a SHA-256 hex digest for the given params dict."""
    return hashlib.sha256(canonicalize_params(params).encode("utf-8")).hexdigest()


def validate_cache_params(params: Any) -> dict[str, Any] | None:
    if params is None:
        return None

    if not isinstance(params, dict):
        raise APIBadRequest("Query parameter 'params' must be a JSON object")

    return params


def read_cache_content_length(req: Request) -> int:
    content_length = req.content_length

    if content_length is None:
        raise APIBadRequest("Content-Length header is required")

    if content_length > CACHE_MAX_SIZE:
        raise APIRequestEntityTooLarge(
            f"Cache payload exceeds maximum size of {CACHE_MAX_SIZE} bytes",
        )

    return content_length


async def cache_body_chunker(
    req: Request,
    content_length: int,
) -> AsyncIterator[bytes]:
    size = 0

    while chunk := await req.content.read(STORAGE_CHUNK_SIZE):
        size += len(chunk)

        if size > content_length:
            raise APIBadRequest("Request body size exceeds Content-Length")

        if size > CACHE_MAX_SIZE:
            raise APIRequestEntityTooLarge(
                f"Cache payload exceeds maximum size of {CACHE_MAX_SIZE} bytes",
            )

        yield chunk

    if size != content_length:
        raise APIBadRequest("Request body size does not match Content-Length")
