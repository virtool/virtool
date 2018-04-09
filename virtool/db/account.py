async def update_settings(db, user_id, update):

    document = await db.users.find_one(user_id, ["settings"])

    settings = {
        **document["settings"],
        **update
    }

    await db.users.update_one({"_id": user_id}, {
        "$set": {
            "settings": settings
        }
    })

    return settings
