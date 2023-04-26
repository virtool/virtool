"""
Utilities used for working with cache files within analysis workflows.

"""
from pathlib import Path

from virtool.config.cls import Config


def join_cache_path(config: Config, cache_id: str) -> Path:
    """
    Create a cache path string given the application configuration and cache id.

    :param config: the application configuration
    :param cache_id: the id of the cache
    :return: a cache path

    """
    return config.data_path / "caches" / cache_id
