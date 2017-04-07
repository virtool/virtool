import dictdiffer

from virtool.utils import timestamp


virus_projection = [
    "_id",
    "annotation",
    "method_name",
    "user_id",
    "index_version",
    "virus_version",
    "timestamp",
    "diff"
]

dispatch_projection = [
    "_id",
    "operation",
    "method_name",
    "timestamp",
    "virus_id",
    "virus_name",
    "virus_version",
    "user_id",
    "index",
    "index_version"
]


projection = dispatch_projection + [
    "annotation",
    "diff"
]


def processor(document):
    document["change_id"] = document.pop("_id")
    return document


async def add(db, method_name, old, new, description, user_id):
    """
    Add a change document to the history collection.
    
    :param db: a database client
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
        virus_version = str(int(new["version"]))
    except TypeError:
        virus_version = "removed"

    document = {
        "_id": ".".join([str(virus_id), virus_version]),
        "method_name": method_name,
        "description": description,
        "timestamp": timestamp(),
        "virus_id": virus_id,
        "virus_version": virus_version,
        "user_id": user_id,
        "index": "unbuilt",
        "index_version": "unbuilt"
    }

    if method_name == "create":
        document["diff"] = new

    elif method_name == "remove":
        document["diff"] = old

    else:
        document["diff"] = calculate_diff(old, new)

    await db.history.insert(document)

    return document


def calculate_diff(old, new):
    return list(dictdiffer.diff(old, new))


async def add_for_import(db, operation, method_name, old, new, username):
    history_document = create_history_document(operation, method_name, old, new, username)

    history_document["imported"] = True

    # Perform the actual database insert operation, retaining the response.
    await db.history.insert(history_document)

    to_dispatch = await sync_processor(db, [{key: history_document[key] for key in projector}])

    return to_dispatch


def strip_isolate(isolate):
    return {key: isolate[key] for key in ("source_type", "source_name", "isolate_id")}


def get_default_isolate(document):
    """
    Return the stripped, default isolate of the given virus ``document``. Raise exceptions if there is not exactly one
    default isolate in the document.

    :param document: a virus document
    :type document: dict

    :return: the stripped, default isolate
    :rtype: dict

    """
    default_isolates = [isolate for isolate in document["isolates"] if isolate["default"]]

    default_isolate_count = len(default_isolates)

    if default_isolate_count > 1:
        raise ValueError("Virus has {} default isolates. Expected exactly 1.".format(default_isolate_count))

    if default_isolate_count == 0:
        raise ValueError("Could not find default isolate in virus document")

    return strip_isolate(default_isolates[0])


def get_upserted_isolate(document, changes):
    for change in changes:
        if change[0] == "change" and change[1][0] == "isolates":
            return document["isolates"][change[1][1]]


def get_info_for_updated_sequence(document, changes):
    for change in changes:
        if change[0] == "change" and change[1][2] == "sequences":
            isolate = document["isolates"][change[1][1]]
            sequence_index = change[1][3]
            sequence = {key: isolate["sequences"][sequence_index][key] for key in ["_id", "definition"]}

            isolate = strip_isolate(isolate)
            isolate.update(sequence)

            return isolate

    raise ValueError("Could not find isolate of updated sequence")


async def get_versioned_document(db, virus_id, virus_version):
    current = await db.viruses.join(virus_id)

    versioned = await patch_virus_to_version(db, current or {"_id": virus_id}, virus_version)

    return current, versioned[1], versioned[2]


async def patch_virus_to_version(db, joined_virus, version):
    virus_history = await db.history.find({"entry_id": joined_virus["_id"]}).to_list(None)

    current = joined_virus or dict()

    # A list of history_ids reverted to produce the patched entry.
    reverted_history_ids = list()

    # Sort the changes be descending entry version.
    virus_history = sorted(virus_history, key=lambda x: x["timestamp"], reverse=True)

    patched = dict(current)

    for history_document in virus_history:
        if history_document["entry_version"] == "removed" or history_document["entry_version"] >= version:
            reverted_history_ids.append(history_document["_id"])

            if history_document["method_name"] == "add":
                patched = "remove"

            elif history_document["method_name"] == "remove":
                patched = history_document["changes"]

            else:
                diff = dictdiffer.swap(history_document["changes"])
                patched = dictdiffer.patch(diff, patched)
        else:
            break

    return current, patched, reverted_history_ids


async def reversion_update(self, history_id, reverted):
    await self.update(history_id, reverted, reversion=True)


async def set_index_as_unbuilt(db, data):
    await db.history.update({"index": data["index_id"]}, {
        "$set": {
            "index": "unbuilt",
            "index_version": "unbuilt"
        }
    })


def format_isolate_name(isolate):
    if isolate["source_type"] is None or isolate["source_name"] is None:
        return "Unnamed isolate"

    return " ".join((isolate["source_type"].capitalize(), isolate["source_name"]))
