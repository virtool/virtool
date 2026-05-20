"""Pure-Python helpers for content-addressing cache entries.

A cache key is the SHA-256 digest of the canonical-form JSON dump of the
:class:`BaseCacheParams` payload. ``canonicalize_params`` produces a stable,
byte-identical serialization so equivalent params always hash to the same key.
"""

import hashlib
import json

from virtool.caches.types import BaseCacheParams


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


def derive_key(params: BaseCacheParams) -> str:
    """Derive the SHA-256 cache key for the given params."""
    return hashlib.sha256(canonicalize_params(params).encode("utf-8")).hexdigest()
