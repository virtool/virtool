from motor.motor_asyncio import AsyncIOMotorCollection
from pymongo import UpdateOne


async def add_subtractions_field(collection: AsyncIOMotorCollection):
    """
    Transform `subtraction` field to a list and rename it as `subtractions`.

    :param collection: the Mongo collection to perform the operation on

    """
    updates = list()

    async for document in collection.find({"subtraction": {"$exists": True}}):
        try:
            subtractions = [document["subtraction"]["id"]]
        except TypeError:
            subtractions = list()

        update = UpdateOne(
            {"_id": document["_id"]},
            {"$set": {"subtractions": subtractions}, "$unset": {"subtraction": ""}},
        )

        updates.append(update)

    if updates:
        await collection.bulk_write(updates)
