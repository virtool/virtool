import logging

import virtool.db.migrate

logger = logging.getLogger("migrate")

NAME_QUERY = {
    "name": {
        "$exists": False
    }
}

async def migrate_subtractions(app):
    db = app["db"]

    logger.info(" • subtraction")
    await virtool.db.migrate.delete_unready(db.subtraction)

    await add_name_field(db)


async def add_name_field(db):
    async for document in db.subtraction.find(NAME_QUERY, ["name"]):
        await db.subtraction.update_one({"_id": document["_id"]}, {
            "$set": {
                "name": document["_id"]
            }
        })
