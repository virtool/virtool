import logging

import virtool.db.migrate

logger = logging.getLogger("migrate")

DELETE_QUERY = {
    "deleted": {
        "$exists": False
    }
}

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
    await add_deleted_field(db)


async def add_deleted_field(db):
    await db.subtraction.update_many(DELETE_QUERY, {
        "$set": {
            "deleted": False
        }
    })


async def add_name_field(db):
    async for document in db.subtraction.find(NAME_QUERY, ["name"]):
        await db.subtraction.update_one({"_id": document["_id"]}, {
            "$set": {
                "name": document["_id"]
            }
        })
