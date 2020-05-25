import os
from typing import Union

import virtool.samples


def join_cache_path(settings: dict, cache_id: str):
    """
    Create a cache path string given the application settings and cache id.

    :param settings: the application settings
    :param cache_id: the id of the cache
    :return: a cache path

    """
    return os.path.join(settings["data_path"], "caches", cache_id)


def join_cache_read_paths(settings: dict, cache: dict) -> Union[list, None]:
    """
    Return a list of read paths for a cache given the application settings and the cache document.

    The path list will contain two paths if paired, and one if not.

    :param settings: the application settings
    :param cache: a cache document
    :return: a list of read paths

    """
    if not cache:
        return None

    cache_path = join_cache_path(settings, cache["id"])

    return virtool.samples.utils.join_read_paths(cache_path, cache["paired"])