"""Work with caches in the database. Caches are bundles of trimmed read and QC data
generated during analyses.
"""

from asyncio import to_thread
from typing import TYPE_CHECKING, Any

import pymongo.errors
from virtool_core.utils import rm

import virtool.utils
from virtool.config import get_config_from_app
from virtool.mongo.utils import get_mongo_from_app
from virtool.types import App
from virtool.utils import base_processor

if TYPE_CHECKING:
    from virtool.mongo.core import Mongo


async def get(mongo: "Mongo", cache_id: str) -> dict[str, Any]:
    """Get the complete representation for the cache with the given `cache_id`.

    :param mongo: the application database client
    :param cache_id: the id of the cache to get
    :return: the cache document

    """
    document = await mongo.caches.find_one(cache_id)
    return base_processor(document)


async def create(
    mongo: "Mongo",
    sample_id: str,
    key: str,
    paired: bool,
) -> dict[str, Any]:
    """Create and insert a new cache database document.
    Return the generated cache document.

    :param mongo: the application database client
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
            "files": [],
            "key": key,
            "legacy": False,
            "missing": False,
            "paired": paired,
            "ready": False,
            "sample": {"id": sample_id},
        }

        await mongo.caches.insert_one(document)

        return base_processor(document)

    except pymongo.errors.DuplicateKeyError as e:
        # Check if key-sample.id uniqueness was enforced
        # Keep trying to add the cache with new ids if the generated id is not unique.
        if "_id" in e.details["keyPattern"]:
            return await create(mongo, sample_id, key, paired)

        raise


async def remove(app: App, cache_id: str):
    """Remove the cache database document and files with the given `cache_id`.

    :param app: the application object
    :param cache_id: the id of the cache to remove

    """
    mongo = get_mongo_from_app(app)

    await mongo.caches.delete_one({"_id": cache_id})

    path = get_config_from_app(app).data_path / "caches" / cache_id

    try:
        await to_thread(rm, path, True)
    except FileNotFoundError:
        pass
