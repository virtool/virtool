"""
Work with caches in the database. Caches are bundles of trimmed read and QC data generated during analyses.

Schema:
- _id (str) the ID of the cache
- created_at (datetime) when the cache record was created
- files (Array[Object]) describes trimmed FASTQ files
  - name (str) the name of the trimmed read file on disk
  - size (int) the size of the file
- hash (str) a hash that uniquely identifies the trim - calculated from the trim parameters used to create the cache
- missing (bool) set to true if the cache cannot be found on disk
- paired (bool) set to true if the cache represents paired data
- parameters (Object) the parameters used to trim the data
- program (str) the name of the program used to trim the data (eg. skewer-0.2.2)
- quality (JSON) the FastQC output converted to a JSON object
- ready (bool) set to true when the cache has be successfully created
- sample (Object) describes the sample the cache is dervied from
  - id (str) the sample ID

"""
import asyncio
import hashlib
import json
import os
from typing import Optional

import aiohttp.web
import pymongo.errors

import virtool.caches
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


async def find(db, sample_id: str, program: str, parameters: dict) -> Optional[dict]:
    """
    Find a cache matching the passed `sample_id`, `program` name and version, and set of trimming `parameters`.

    If no matching cache exists, `None` will be returned.

    :param db: the application database interface
    :param sample_id: the id of the parent sample
    :param program: the program and version used to create the cache
    :param parameters: the parameters used for the trim
    :return: a cache document

    """
    document = await db.caches.find_one({
        "hash": virtool.caches.db.calculate_cache_hash(parameters),
        "missing": False,
        "program": program,
        "sample.id": sample_id
    })

    return virtool.utils.base_processor(document)


async def find_and_wait(db, sample_id: str, program: str, parameters: dict) -> Optional[dict]:
    """
    Find a cache matching the passed `sample_id`, `program` name and version, and set of trimming `parameters`. Wait
    for the cache to be ready if it is still being created.

    If no matching cache exists, `None` will be returned.

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


async def get(db, cache_id: str) -> dict:
    """
    Get the complete representation for the cache with the given `cache_id`.

    :param db: the application database client
    :param cache_id: the id of the cache to get
    :return: the cache document

    """
    document = await db.caches.find_one(cache_id)
    return virtool.utils.base_processor(document)


async def create(db, sample_id: str, parameters: dict, paired: bool, legacy: bool = False, program: str = "skewer-0.2.2"):
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

        document = {
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
        }

        await db.caches.insert_one(document)

        return virtool.utils.base_processor(document)

    except pymongo.errors.DuplicateKeyError:
        # Keep trying to add the cache with new ids if the generated id is not unique.
        return await create(db, sample_id, parameters, paired, legacy=legacy, program=program)


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
