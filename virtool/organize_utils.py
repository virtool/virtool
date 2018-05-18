async def update_user_field(collection):
    await collection.update_many({}, {
        "$rename": {
            "username": "user_id"
        }
    })

    async for document in collection.find({"user_id": {"$exists": True}}):
        await collection.update_one({"_id": document["_id"]}, {
            "$set": {
                "user": {
                    "id": document["user_id"]
                }
            }
        })

    await collection.update_many({"user_id": {"$exists": True}}, {
        "$unset": {
            "user_id": ""
        }
    })


async def unset_version_field(collection):
    await collection.update_many({"_version": {"$exists": True}}, {
        "$unset": {
            "_version": ""
        }
    })
