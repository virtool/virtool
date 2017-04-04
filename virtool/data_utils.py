from virtool.utils import random_alphanumeric


async def get_new_id(collection, excluded=None, randomizer=None):
    """
    Returns a new, unique, id that can be used for inserting a new document. Will not return any id that is included
    in ``excluded``.

    """
    excluded = excluded or list()

    existing_ids = await collection.distinct("_id")

    excluded += existing_ids

    excluded = set(excluded)

    return random_alphanumeric(length=8, excluded=excluded, randomizer=randomizer)


def coerce_list(obj):
    """
    Takes an object of any type and returns a list. If ``obj`` is a list it will be passed back with modification.
    Otherwise, a single-item list containing ``obj`` will be returned.

    :param obj: an object of any type.
    :type obj: any

    :return: a list equal to or containing ``obj``.
    :rtype: list

    """
    return [obj] if not isinstance(obj, list) else obj


def to_bool(obj):
    return str(obj).lower() in ["1", "true"]
