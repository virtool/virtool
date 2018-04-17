async def id_exists(collection, _id):
    """
    Check if the document id exists in the collection.

    :param collection: a Motor collection object

    :param _id: the _id to check for
    :type _id: str

    :return: ``bool`` indicating if the user exists

    """
    return bool(await collection.count({"_id": _id}))
async def get_new_id(collection, excluded=None):
    """
    Returns a new, unique, id that can be used for inserting a new document. Will not return any id that is included
    in ``excluded``.

    :param collection: the Mongo collection to get a new _id for
    :type collection: :class:`motor.motor_asyncio.AsyncIOMotorCollection`

    :param excluded: a list of ids to exclude from the search
    :type excluded: Union[None, list]

    :return: an id unique to the collection
    :rtype: str

    """
    excluded = set(excluded) or set()

    excluded += set(await collection.distinct("_id"))

    return random_alphanumeric(length=8, excluded=list(excluded))


async def get_non_existent_ids(collection, id_list):
    existing_group_ids = await collection.distinct("_id", {"_id": {"$in": id_list}})
    return set(id_list) - set(existing_group_ids)




