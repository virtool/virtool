import aiohttp.web
import hashlib
import json
import os

import pymongo.errors

import virtool.utils

PROJECTION = [
    "_id",
    "created_at",
    "files",
    "hash",
    "program",
    "ready",
    "sample"
]


def calculate_cache_hash(parameters: dict) -> str:
    """
    Calculate a hash from the parameters `dict` for a cache. The parameters are arguments passed to a trimming program.
    Caches can be reused when the hash of the trim parameters for a a new analysis matches an existing cache.

    :param parameters: the trimming parameters
    :return: the cache hash

    """
    string = json.dumps(parameters, sort_keys=True)
    return hashlib.sha1(string.encode()).hexdigest()


def create(db, sample_id: str, parameters: dict, paired: bool, legacy: bool = False, program: str = "skewer-0.2.2"):
    """
    Create and insert a new cache database document. Return the generated unique cache id.

    :param db: the application database client
    :param sample_id: the id of the sample the cache is derived from
    :param parameters: the trim parameters
    :param paired: boolean indicating if the sample contains paired data
    :param legacy: boolean indicating if the cache is derived from a trimmed legacy sample
    :param program: the trimming program used
    :return: the new cache id

    """
    try:
        cache_id = virtool.utils.random_alphanumeric(length=8)

        db.caches.insert_one({
            "_id": cache_id,
            "created_at": virtool.utils.timestamp(),
            "files": list(),
            "hash": calculate_cache_hash(parameters),
            "legacy": legacy,
            "missing": False,
            "paired": paired,
            "parameters": parameters,
            "program": program,
            "ready": False,
            "sample": {
                "id": sample_id
            }
        })

        return cache_id

    except pymongo.errors.DuplicateKeyError:
        # Keep trying to add the cache with new ids if the generated id is not unique.
        return create(db, sample_id, parameters, paired, legacy, program)


async def get(db, cache_id: str) -> dict:
    """
    Get the complete representation for the cache with the given `cache_id`.

    :param db: the application database client
    :param cache_id: the id of the cache to get
    :return: the cache document

    """
    document = await db.caches.find_one(cache_id)
    return virtool.utils.base_processor(document)


async def remove(app: aiohttp.web.Application, cache_id: str):
    """
    Remove the cache database document and files with the given `cache_id`.

    :param app: the application object
    :param cache_id: the id of the cache to remove

    """
    db = app["db"]
    settings = app["settings"]

    await db.caches.delete_one({
        "_id": cache_id
    })

    path = os.path.join(settings["data_path"], "caches", cache_id)

    try:
        await app["run_in_thread"](virtool.utils.rm, path, True)
    except FileNotFoundError:
        pass
