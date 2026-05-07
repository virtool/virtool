from pathlib import Path


def cache_blob_path(data_path: Path, key: str) -> Path:
    """Return the on-disk path for the cache blob identified by ``key``.

    The first two characters of the key are used as a sharding directory to
    keep any one directory from accumulating too many entries.
    """
    return data_path / "storage" / "caches" / key[:2] / key
