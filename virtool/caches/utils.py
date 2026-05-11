"""Pure-Python helpers for content-addressing cache entries.

A cache key is the SHA-256 digest of the NUL-joined canonical form of
``(cache_type, canonical_params, parent_id)``. ``tool_name`` and
``tool_version`` are passed explicitly and folded into the canonical params
alongside any caller-supplied fields. ``tool_version`` is normalized before
canonicalization so that build metadata does not change the key.
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


def build_stored_params(
    tool_name: str,
    tool_version: str,
    params: dict[str, Any],
) -> dict[str, Any]:
    """Return the JSONB-ready params dict for a cache entry.

    Merges the explicit tool fields into ``params`` with the version
    semver-normalized. Explicit arguments win over any same-named keys in
    ``params``.
    """
    return {
        **params,
        "tool_name": tool_name,
        "tool_version": normalize_semver(tool_version),
    }


def derive_key(
    cache_type: CacheType,
    parent_id: str,
    tool_name: str,
    tool_version: str,
    params: dict[str, Any],
) -> str:
    """Derive the SHA-256 cache key for the given inputs.

    ``tool_version`` is normalized before canonicalization; ``tool_name`` and
    the normalized version are folded into ``params`` for the canonical form.
    """
    payload = _KEY_FIELD_SEPARATOR.join(
        [
            cache_type.value,
            canonicalize_params(
                build_stored_params(tool_name, tool_version, params),
            ),
            parent_id,
        ],
    )

    return hashlib.sha256(payload.encode("utf-8")).hexdigest()
