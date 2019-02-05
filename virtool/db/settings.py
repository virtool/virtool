import logging

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


async def get(db):
    settings = await db.settings.find_one("settings", projection=PROJECTION)

    if settings:
        return settings

    return dict()


async def update(db, updates):
    return await db.settings.find_one_and_update({"_id": "settings"}, {
        "$set": updates
    })
