async def id_exists(collection, _id):
    """
    Check if the document id exists in the collection.

    :param collection: a Motor collection object

    :param _id: the _id to check for
    :type _id: str

    :return: ``bool`` indicating if the user exists

    """
    return bool(await collection.count({"_id": _id}))


async def get_non_existent_ids(collection, id_list):
    existing_group_ids = await collection.distinct("_id", {"_id": {"$in": id_list}})
    return set(id_list) - set(existing_group_ids)




