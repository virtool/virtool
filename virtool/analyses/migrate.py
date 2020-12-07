import virtool.db.migrate
import virtool.db.utils
import virtool.types


async def migrate_analyses(app: virtool.types.App):
    """
    Delete unready analyses.

    :param app: the application object

    """
    await virtool.db.utils.delete_unready(app["db"].analyses)
    await change_to_subtractions_list(app["db"])


async def change_to_subtractions_list(db):
    async for document in db.analyses.find():
        if "subtraction" in document:
            await db.analyses.update_one({"_id": document["_id"]}, {
                "$set": {
                    "subtractions": [document["subtraction"]["id"]]
                },
                "$unset": {
                    "subtraction": ""
                }
            })

