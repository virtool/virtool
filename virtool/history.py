import dictdiffer

from virtool.utils import timestamp
from virtool.data_utils import coerce_list


projector = [
    "_id",
    "_version",
    "operation",
    "method_name",
    "changes",
    "timestamp",
    "entry_id",
    "entry_version",
    "username",
    "annotation",
    "index",
    "index_version"
]


async def sync_processor(db, documents):
    documents = coerce_list(documents)

    for document in documents:
        if document["operation"] in ["insert", "remove"]:
            document["virus"] = document["changes"]["name"]
        else:
            _, patched, _ = await get_versioned_document(db, document["entry_id"], document["entry_version"])
            document["virus"] = patched["name"]

    return documents


def create_history_document(operation, method_name, old, new, username):
    # Construct and _id for the change entry. It is composed of the _id of the changed entry and the new version
    # number of the entry separated by a dot (eg. a7sds23.3)
    try:
        document_id = old["_id"]
    except TypeError:
        document_id = new["_id"]

    try:
        document_version = new["_version"]
    except TypeError:
        document_version = "removed"

    history_document = {
        "_id": str(document_id) + "." + (str(document_version)),
        "_version": 0,
        "operation": operation,
        "method_name": method_name,
        "timestamp": timestamp(),
        "entry_id": document_id,
        "entry_version": document_version,
        "username": username,
        "annotation": None,
        "index": "unbuilt",
        "index_version": "unbuilt"
    }

    if operation in ["update", "remove", "insert"]:
        if operation == "update":
            history_document["changes"] = list(dictdiffer.diff(old, new))
        elif operation == "remove":
            history_document["changes"] = old
        else:
            history_document["changes"] = new
    else:
        raise ValueError("Passed operation is not one of 'update', 'remove', 'insert'")

    if method_name == "set_default_isolate":
        history_document["annotation"] = get_default_isolate(new)

    if method_name == "upsert_isolate":
        history_document["annotation"] = get_upserted_isolate(old, history_document["changes"])

    if method_name == "remove_sequence":
        subject_isolate = get_isolate_of_removed_sequence(old, history_document["changes"])
        assert subject_isolate is not None
        history_document["annotation"] = subject_isolate

    if method_name == "add_sequence":
        subject_isolate = get_isolate_of_added_sequence(new, history_document["changes"])
        history_document["annotation"] = subject_isolate

    if method_name == "update_sequence":
        subject_isolate = get_info_for_updated_sequence(new, history_document["changes"])
        history_document["annotation"] = subject_isolate

    return history_document


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


async def add(db, operation, method_name, old, new, username):
    history_document = create_history_document(operation, method_name, old, new, username)

    history_document["imported"] = False

    await db.history.insert(history_document)


async def add_for_import(db, operation, method_name, old, new, username):
    history_document = create_history_document(operation, method_name, old, new, username)

    history_document["imported"] = True

    # Perform the actual database insert operation, retaining the response.
    await db.history.insert(history_document)

    to_dispatch = await sync_processor(db, [{key: history_document[key] for key in projector}])

    return to_dispatch


def strip_isolate(isolate):
    return {key: isolate[key] for key in ["source_type", "source_name", "isolate_id"]}


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


def get_isolate_of_added_sequence(document, changes):
    for change in changes:
        if change[0] == "add" and change[1][0] == "isolates":
            isolate_index = change[1][1]
            return strip_isolate(document["isolates"][isolate_index])

    raise ValueError("Could not find isolate of added sequence")


def get_isolate_of_removed_sequence(document, changes):
    for change in changes:
        if change[0] == "remove":
            isolate_index = change[1][1]
            return strip_isolate(document["isolates"][isolate_index])

    raise ValueError("Could not find isolate of removed sequence")
