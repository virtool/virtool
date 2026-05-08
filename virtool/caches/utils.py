"""Pure-Python helpers for content-addressing cache entries.

A cache key is the SHA-256 digest of the NUL-joined canonical form of
``(cache_type, canonical_params, parent_id)``. ``params`` must include
``tool_name`` and ``tool_version`` — the data layer enforces this on insert.
``tool_version`` is normalized before canonicalization so that build metadata
does not change the key.
"""

import hashlib
import json
from typing import Any

from semver import VersionInfo

from virtool.caches.types import CacheType

_KEY_FIELD_SEPARATOR = "\x00"


def canonicalize_params(params: dict[str, Any]) -> str:
    """Serialize ``params`` to a stable, byte-identical string.

    Keys are sorted, separators are tight, and non-ASCII characters are
    escaped so the output is independent of platform locale.
    """
    return json.dumps(params, sort_keys=True, separators=(",", ":"), ensure_ascii=True)


def normalize_semver(tool_version: str) -> str:
    """Return ``tool_version`` with build metadata stripped.

    The pre-release segment is preserved so that ``1.2.3-rc.1`` and
    ``1.2.3`` produce different keys. Build metadata (``+...``) is dropped
    because it does not change tool behavior.
    """
    version = VersionInfo.parse(tool_version.lstrip("v"))
    return str(version.replace(build=None))


def normalize_params(params: dict[str, Any]) -> dict[str, Any]:
    """Return a copy of ``params`` with ``tool_version`` semver-normalized."""
    return {**params, "tool_version": normalize_semver(params["tool_version"])}


def derive_key(
    cache_type: CacheType,
    params: dict[str, Any],
    parent_id: str,
) -> str:
    """Derive the SHA-256 cache key for the given inputs.

    ``params`` must contain ``tool_name`` and ``tool_version``; the version is
    normalized before canonicalization.
    """
    payload = _KEY_FIELD_SEPARATOR.join(
        [
            cache_type.value,
            canonicalize_params(normalize_params(params)),
            parent_id,
        ],
    )

    return hashlib.sha256(payload.encode("utf-8")).hexdigest()
