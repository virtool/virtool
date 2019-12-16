import os


async def migrate_caches(app):
    await add_missing_field(app)


async def add_missing_field(app):
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
