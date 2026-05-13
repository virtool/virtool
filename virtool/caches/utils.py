"""Pure-Python helpers for content-addressing cache entries.

A cache key is the SHA-256 digest of the NUL-joined canonical form of
``(cache_type, canonical_params, parent_id)``. ``canonical_params`` is the
sorted-key, tight-separator JSON dump of the :class:`BaseCacheParams` payload.
"""

import hashlib
import json

from virtool.caches.types import BaseCacheParams

_KEY_FIELD_SEPARATOR = "\x00"


def canonicalize_params(params: BaseCacheParams) -> str:
    """Serialize ``params`` to a stable, byte-identical string.

    Keys are sorted, separators are tight, and non-ASCII characters are
    escaped so the output is independent of platform locale.
    """
    return json.dumps(
        params.dict(),
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=True,
    )


def derive_key(cache_type: str, parent_id: str, params: BaseCacheParams) -> str:
    """Derive the SHA-256 cache key for the given inputs."""
    payload = _KEY_FIELD_SEPARATOR.join(
        [cache_type, canonicalize_params(params), parent_id],
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()
