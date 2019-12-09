import pymongo

LIBRARY_TYPE_QUERY = {
    "library_type": {
        "$exists": False
    }
}


async def add_library_type(db):
    """
    Add a `library_type` field that is calculated from the `srna` field of each sample document.

    If the `srna` field is not defined `library_type` is set to normal.

    """
    if await db.samples.count(LIBRARY_TYPE_QUERY):
        updates = list()

        async for document in db.samples.find(LIBRARY_TYPE_QUERY, ["_id", "srna"]):
            update = pymongo.UpdateOne({"_id": document["_id"]}, {
                "$set": {
                    "library_type": "srna" if document.get("srna") else "normal"
                },
                "$unset": {
                    "srna": ""
                }
            })

            updates.append(update)

        await db.samples.bulk_write(updates)
