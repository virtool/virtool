import logging

import virtool.settings.schema

logger = logging.getLogger(__name__)

PROJECTION = {
    "_id": False
}

CONFIG_PROJECTION = (
    "data_path",
    "watch_path",
    "proc",
    "mem",
    "lg_proc",
    "lg_mem",
    "sm_proc",
    "sm_mem"
)


async def ensure(db):
    existing = await db.settings.find_one({"_id": "settings"}, {"_id": False}) or dict()
    defaults = virtool.settings.schema.get_defaults()

    ensure_update = {
        **defaults,
        **existing
    }

    await db.settings.update_one({"_id": "settings"}, {
        "$set": ensure_update
    }, upsert=True)

    return ensure_update


async def get(db):
    settings = await db.settings.find_one("settings", projection=PROJECTION)

    if settings:
        return settings

    return dict()


async def update(db, updates):
    return await db.settings.find_one_and_update({"_id": "settings"}, {
        "$set": updates
    })
