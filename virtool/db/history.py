from copy import deepcopy

import dictdiffer

import virtool.db.species
import virtool.kinds
import virtool.utils
import virtool.history

MOST_RECENT_PROJECTION = [
    "_id",
    "description",
    "method_name",
    "user",
    "virus",
    "created_at"
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
    :type new: Union[dict, None]

    :param new: the virus document after the change
    :type new: Union[dict, None]

    :param description: a human readable description of the change
    :type description: str

    :param user_id: the id of the requesting user
    :type user_id: str

    :return: the change document
    :rtype: Coroutine[dict]

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
        document["diff"] = virtool.history.calculate_diff(old, new)

    await db.history.insert_one(document)

    return document


async def get_most_recent_change(db, virus_id):
    """
    Get the most recent change for the virus identified by the passed ``virus_id``.

    :param db: the application database client
    :type db: :class:`~motor.motor_asyncio.AsyncIOMotorClient`

    :param virus_id: the target virus_id
    :type virus_id: str

    :return: the most recent change document
    :rtype: Coroutine[dict]

    """
    return await db.history.find_one({
        "virus.id": virus_id,
        "index.id": "unbuilt"
    }, MOST_RECENT_PROJECTION, sort=[("created_at", -1)])


async def patch_to_version(db, virus_id, version):
    """
    Take a joined virus back in time to the passed ``version``. Uses the diffs in the change documents associated with
    the virus.

    :param db: the application database client
    :type db: :class:`~motor.motor_asyncio.AsyncIOMotorClient`

    :param virus_id: the id of the virus to patch
    :type virus_id: str

    :param version: the version to patch to
    :type version: str or int

    :return: the current joined virus, patched virus, and the ids of changes reverted in the process
    :rtype: Coroutine[tuple]

    """
    # A list of history_ids reverted to produce the patched entry.
    reverted_history_ids = list()

    current = await virtool.db.species.join(db, virus_id) or dict()

    if "version" in current and current["version"] == version:
        return current, deepcopy(current), reverted_history_ids

    patched = deepcopy(current)

    # Sort the changes by descending timestamp.
    async for change in db.history.find({"virus.id": virus_id}, sort=[("created_at", -1)]):
        if change["virus"]["version"] == "removed" or change["virus"]["version"] > version:
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

    if current == {}:
        current = None

    return current, patched, reverted_history_ids
