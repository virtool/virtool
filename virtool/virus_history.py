import dictdiffer
from copy import deepcopy

import virtool.utils


MOST_RECENT_PROJECTION = [
    "_id",
    "description",
    "method_name",
    "user",
    "virus",
    "timestamp",
]

LIST_PROJECTION = [
    "_id",
    "description",
    "method_name",
    "created_at",
    "virus",
    "index",
    "user"
]

PROJECTION = LIST_PROJECTION + [
    "diff"
]


async def add(db, method_name, old, new, description, user_id):
    """
    Add a change document to the history collection.
    
    :param db: the application database client
    :type db: :class:`~motor.motor_asyncio.AsyncIOMotorClient`
    
    :param method_name: the name of the handler method that executed the change
    :type method_name: str
    
    :param old: the virus document prior to the change
    :type old: dict
    
    :param new: the virus document after the change
    :type new: dict
    
    :param description: a human readable description of the change
    :type description: str 
    
    :param user_id: 
    :type user_id: str
    
    :return: the change document
    :rtype: dict
    
    """
    try:
        virus_id = old["_id"]
    except TypeError:
        virus_id = new["_id"]

    try:
        virus_name = old["name"]
    except TypeError:
        virus_name = new["name"]

    try:
        virus_version = int(new["version"])
    except (TypeError, KeyError):
        virus_version = "removed"

    document = {
        "_id": ".".join([str(virus_id), str(virus_version)]),
        "method_name": method_name,
        "description": description,
        "created_at": virtool.utils.timestamp(),
        "virus": {
            "id": virus_id,
            "name": virus_name,
            "version": virus_version
        },
        "index": {
            "id": "unbuilt",
            "version": "unbuilt"
        },
        "user": {
            "id": user_id
        }
    }

    if method_name == "create":
        document["diff"] = new

    elif method_name == "remove":
        document["diff"] = old

    else:
        document["diff"] = calculate_diff(old, new)

    await db.history.insert_one(document)

    return document


def calculate_diff(old, new):
    """
    Calculate the diff for a joined virus document before and after modification.
    
    :param old: the joined virus document before modification
    :type old: dict
    
    :param new: the joined virus document after modification
    :type new: dict
    
    :return: the diff
    :rtype: list
    
    """
    return list(dictdiffer.diff(old, new))


async def get_most_recent_change(db, virus_id):
    """
    Get the most recent change for the virus identified by the passed ``virus_id``.
    
    :param db: the application database client
    :type db: :class:`~motor.motor_asyncio.AsyncIOMotorClient`
    
    :param virus_id: the target virus_id
    :type virus_id: str
    
    :return: the most recent change document
    :rtype: dict
    
    """
    return await db.history.find_one({
        "virus_id": virus_id,
        "index_id": "unbuilt"
    }, MOST_RECENT_PROJECTION, sort=[("created_at", -1)])


async def patch_virus_to_version(db, joined_virus, version, inclusive=False):
    """
    Take a joined virus back in time to the passed ``version``. Uses the diffs in the change documents associated with
    the virus.    
    
    :param db: the application database client
    :type db: :class:`~motor.motor_asyncio.AsyncIOMotorClient`
     
    :param joined_virus: the joined virus to patch
    :type joined_virus: dict
    
    :param version: the version to patch to
    :type version: str or int
    
    :param inclusive: also remove the passed ``version``
    :type inclusive: bool
    
    :return: the current joined virus, patched virus, and the ids of changes reverted in the process
    :rtype: tuple
    
    """
    # A list of history_ids reverted to produce the patched entry.
    reverted_history_ids = list()

    current = joined_virus or dict()

    patched = deepcopy(current)

    comparator = get_version_comparator(inclusive)

    # Sort the changes by descending timestamp.
    async for change in db.history.find({"virus_id": joined_virus["_id"]}, sort=[("created_at", -1)]):
        if change["virus_version"] == "removed" or comparator(change, version):
            reverted_history_ids.append(change["_id"])

            if change["method_name"] == "remove":
                patched = change["diff"]

            elif change["method_name"] == "create":
                patched = None

            else:
                diff = dictdiffer.swap(change["diff"])
                patched = dictdiffer.patch(diff, patched)
        else:
            break

    return current, patched, reverted_history_ids


def get_version_comparator(inclusive):
    if inclusive:
        def func(change, version):
            return change["virus_version"] >= version
    else:
        def func(change, version):
            return change["virus_version"] > version

    return func


async def set_index_as_unbuilt(db, index_id):
    """
    Set the ``index_id`` and ``index_version`` fields to "unbuilt" for all change documents with the passed
    ``index_id``. This is called in the event that a index rebuild process fails. 
    
    :param db: the application database client
    :type db: :class:`~motor.motor_asyncio.AsyncIOMotorClient`
     
    :param index_id: the ``index_id`` to replace
    :type index_id: str

    """
    await db.history.update_many({"index_id": index_id}, {
        "$set": {
            "index_id": "unbuilt",
            "index_version": "unbuilt"
        }
    })

