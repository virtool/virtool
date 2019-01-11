import logging

logger = logging.getLogger(__name__)

PROJECTION = {
    "_id": False
}

async def update(db, updates):
    return await db.settings.find_one_and_update({"_id": "settings"}, {
        "$set": updates
    })



