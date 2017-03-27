from virtool.utils import random_alphanumeric


async def get_new_id(collection, excluded=None, randomizer=None):
    """
    Returns a new, unique, id that can be used for inserting a new document. Will not return any id that is included
    in ``excluded``.

    :param excluded: document ids to exclude
    :type excluded: list

    :param randomizer: a function to return random strings
    :type randomizer: callable

    :return: a random 8-character alphanumeric document id.
    :rtype: str

    """
    excluded = excluded or list()

    existing_ids = await collection.distinct("_id")

    excluded += existing_ids

    excluded = set(excluded)

    return random_alphanumeric(length=8, excluded=excluded, randomizer=randomizer)
