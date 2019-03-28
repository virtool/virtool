import hashlib
import json
import os

import pymongo.errors

import virtool.utils

PROJECTION = [
    "_id",
    "files",
    "hash",
    "parameters",
    "program",
    "ready",
    "sample"
]


def calculate_cache_hash(parameters):
    string = json.dumps(parameters, sort_keys=True)
    return hashlib.sha1(string.encode()).hexdigest()


def create(db, sample_id, parameters, paired, legacy=False):
    try:
        cache_id = virtool.utils.random_alphanumeric(length=8)

        db.caches.insert_one({
            "_id": cache_id,
            "created_at": virtool.utils.timestamp(),
            "files": list(),
            "hash": calculate_cache_hash(parameters),
            "legacy": legacy,
            "paired": paired,
            "parameters": parameters,
            "program": "skewer-0.2.2",
            "ready": False,
            "sample": {
                "id": sample_id
            }
        })

        return cache_id

    except pymongo.errors.DuplicateKeyError:
        return create(db, sample_id, parameters, paired, legacy=legacy)


async def get(db, sample_id, parameters):
    document = await db.find_one({
        "_id": sample_id,
        "hash": calculate_cache_hash(parameters)
    })

    if document:
        return virtool.utils.base_processor(document)


async def prune(app):
    """
    db = app["db"]

    seen_hashes = set()

    pipeline = [

    ]

    cursor =

    async for document in db.caches.find({"ready": True}, ["hash"]):
        if document["hash"] in seen_hashes:
    """
    pass


async def remove(app, cache_id):
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
