"""
Work with caches in the database. Caches are bundles of trimmed read and QC data generated during
analyses.

"""
import asyncio
import hashlib
import json
import os
from typing import Any, Dict, Optional

import pymongo.errors

import virtool.caches
import virtool.utils
from virtool.types import App

PROJECTION = (
    "_id",
    "created_at",
    "files",
    "key",
    "program",
    "ready",
    "sample"
)


def calculate_cache_key(parameters: Dict[str, Any]) -> str:
    """
    Calculate a key from the parameters `dict` for a cache.

    The parameters are arguments passed to a trimming program. Caches can be reused when the key
    of the trim parameters for a a new analysis matches an existing cache.

    :param parameters: the trimming parameters
    :return: the cache key

    """
    string = json.dumps(parameters, sort_keys=True)
    return hashlib.sha1(string.encode()).hexdigest()


async def find(db, sample_id: str, program: str, parameters: Dict[str, Any]) -> Optional[dict]:
    """
    Find a cache matching the passed `sample_id`, `program` name and version, and set of trimming
    `parameters`.

    If no matching cache exists, `None` will be returned.

    :param db: the application database interface
    :param sample_id: the id of the parent sample
    :param program: the program and version used to create the cache
    :param parameters: the parameters used for the trim
    :return: a cache document

    """
    document = await db.caches.find_one({
        "key": virtool.caches.db.calculate_cache_key(parameters),
        "missing": False,
        "program": program,
        "sample.id": sample_id
    })

    return virtool.utils.base_processor(document)


async def find_and_wait(
        db, sample_id: str,
        program: str,
        parameters: Dict[str, Any]
) -> Optional[dict]:
    """
    Find a cache matching the passed `sample_id`, `program` name and version, and set of trimming
    `parameters`.

    Waits for the cache to be ready if it is still being created. If no matching cache exists,
    `None` will be returned.

    :param db: the application database interface
    :param sample_id: the id of the parent sample
    :param program: the program and version used to create the cache
    :param parameters: the parameters used for the trim
    :return: a cache document

    """
    document = await find(db, sample_id, program, parameters)

    if document:
        cache_id = document["id"]

        while document["ready"] is False:
            await asyncio.sleep(2)
            document = virtool.utils.base_processor(await db.caches.find_one(cache_id))

    return virtool.utils.base_processor(document)


async def get(db, cache_id: str) -> Dict[str, Any]:
    """
    Get the complete representation for the cache with the given `cache_id`.

    :param db: the application database client
    :param cache_id: the id of the cache to get
    :return: the cache document

    """
    document = await db.caches.find_one(cache_id)
    return virtool.utils.base_processor(document)


async def create(
        db,
        sample_id: str,
        key: str,
        paired: bool,
):
    """
    Create and insert a new cache database document. Return the generated cache document.

    :param db: the application database client
    :param sample_id: the id of the sample the cache is derived from
    :param key: Unique key for a cache
    :param paired: boolean indicating if the sample contains paired data
    :return: The new cache document as a dictionary.

    """
    try:
        cache_id = virtool.utils.random_alphanumeric(length=8)

        document = {
            "_id": cache_id,
            "created_at": virtool.utils.timestamp(),
            "files": list(),
            "key": key,
            "legacy": False,
            "missing": False,
            "paired": paired,
            "ready": False,
            "sample": {
                "id": sample_id
            }
        }

        await db.caches.insert_one(document)

        return virtool.utils.base_processor(document)

    except pymongo.errors.DuplicateKeyError as e:
        # Check if key-sample.id uniqueness was enforced
        # Keep trying to add the cache with new ids if the generated id is not unique.
        if "_id" in e.details["keyPattern"]:
            return await create(db, sample_id, key, paired)

        raise


async def remove(app: App, cache_id: str):
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
