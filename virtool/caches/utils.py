"""
Utilities used for working with cache files within analysis workflows.

"""
from pathlib import Path
from typing import Any, Dict


def join_cache_path(settings: Dict[str, Any], cache_id: str) -> Path:
    """
    Create a cache path string given the application settings and cache id.

    :param settings: the application settings
    :param cache_id: the id of the cache
    :return: a cache path

    """
    return settings["data_path"] / "caches" / cache_id
