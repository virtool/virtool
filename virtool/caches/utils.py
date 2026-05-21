"""Pure-Python helpers for content-addressing cache entries.

These helpers are offered to downstream consumers that want to derive a
stable cache key from a parameter dict. The caches data layer does not call
them — callers supply a precomputed key to
:meth:`virtool.caches.data.CachesData.get` and
:meth:`virtool.caches.data.CachesData.create`. There is no defined
relationship between a row's key and any params dict the caller may pass.
"""

import hashlib
import json
from typing import Any


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
