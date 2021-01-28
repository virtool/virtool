"""
Operation that should be performed on caches when the application starts.

"""

import os

from virtool.types import App


async def migrate_caches(app: App):
    """
    Apply automatic updates to cache documents on application start.

    :param app: the application object

    """
    await add_missing_field(app)


async def add_missing_field(app: App):
    """
    Add a field `missing` to all cache documents. Set the field to `True` if the cache is not
    found on disk.

    :param app: the application object

    """
    db = app["db"]

    path = os.path.join(app["settings"]["data_path"], "caches")

    found_cache_ids = os.listdir(path)

    await db.caches.update_many({}, {
        "$set": {
            "missing": False
        }
    })

    await db.caches.update_many({"_id": {"$nin": found_cache_ids}}, {
        "$set": {
            "missing": True
        }
    })
