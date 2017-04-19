import os
import re
import logging
import json
import gzip

from copy import deepcopy
from pymongo import ReturnDocument

from virtool.data_utils import get_new_id, format_doc_id
from virtool.utils import random_alphanumeric
from virtool import history

logger = logging.getLogger(__name__)


ISOLATE_SCHEMA = {
    "source_type": {"type": "string", "default": ""},
    "source_name": {"type": "string", "default": ""},
    "default": {"type": "boolean", "default": False}
}

LIST_PROJECTION = [
    "_id",
    "name",
    "abbreviation",
    "version",
    "modified"
]

SEQUENCE_PROJECTION = [
    "_id",
    "definition",
    "host",
    "isolate_id",
    "sequence"
]


def processor(document):
    return format_doc_id("virus", dict(document))


def dispatch_version_only(req, new):
    req.app["dispatcher"].dispatch(
        "viruses",
        "update",
        processor({key: new[key] for key in LIST_PROJECTION})
    )


def sequence_processor(document):
    document = dict(document)
    document["accession"] = document.pop("_id")
    return document


async def join(db, virus_id, document=None):
    """
    Join the virus associated with the supplied virus id with its sequences. If a virus entry is also passed, the
    database will not be queried for the virus based on its id.
    
    :param db: a database client

    :param virus_id: the id of the virus to join.
    :type virus_id: str

    :param document: use this virus document as a basis for the join instead finding it using the virus id.
    :type document: dict

    :return: the joined virus document
    :rtype: dict

    """
    # Get the virus entry if a virus parameter was not passed.
    document = document or await db.viruses.find_one(virus_id)

    if document is None:
        return None

    # Extract the isolate_ids associated with the virus.
    isolate_ids = extract_isolate_ids(document)

    # Get the sequence entries associated with the isolate ids.
    sequences = await db.sequences.find({"isolate_id": {"$in": isolate_ids}}).to_list(None) or []

    # Merge the sequence entries into the virus entry.
    return merge_virus(document, sequences)


async def get_complete(db, virus_id):
    joined = await join(db, virus_id)

    if not joined:
        return None

    joined = processor(joined)

    joined.pop("lower_name")

    for isolate in joined["isolates"]:
        for sequence in isolate["sequences"]:
            sequence["accession"] = sequence.pop("_id")

    most_recent_change = await history.get_most_recent_change(db, virus_id)

    if most_recent_change:
        most_recent_change["change_id"] = most_recent_change.pop("_id")

    joined["most_recent_change"] = most_recent_change

    return joined


async def check_name_and_abbreviation(db, name=None, abbreviation=None):
    unique_name = not (name and await db.viruses.find({"name": re.compile(name, re.IGNORECASE)}).count())
    unique_abbreviation = not (abbreviation and await db.viruses.find({"abbreviation": abbreviation}).count())

    if not unique_name and not unique_abbreviation:
        return "Name and abbreviation already exist"

    if not unique_name:
        return "Name already exists"

    if not unique_abbreviation:
        return "Abbreviation already exists"

    return False


def export_file(self):
    """
    Removes a sequence from the sequence collection and from its associated virus document. Takes virus id,
    isolate id, and the sequence id to be removed.

    """
    # A list of joined viruses.
    virus_list = list()

    cursor = self.find()

    while (yield cursor.fetch_next):
        virus = cursor.next_object()

        if virus["last_indexed_version"] is not None:
            # Join the virus document with its associated sequence documents.
            joined = yield self.join(virus["_id"], virus)

            # If the virus has been changed since the last index rebuild, patch it to its last indexed version.
            if virus["_version"] != virus["last_indexed_version"]:
                _, joined, _ = yield self.collections["history"].patch_virus_to_version(
                    joined,
                    virus["last_indexed_version"]
                )

            virus_list.append(joined)

    # Convert the list of viruses to a JSON-formatted string.
    json_string = json.dumps(virus_list)

    # Compress the JSON string with gzip.
    body = gzip.compress(bytes(json_string, "utf-8"))

    # Register the file content with the file manager. The file manager will write the content to a file and make
    # it available for download. It returns a file_id that will be passed back to the client so it can send in a
    # request to download the file.
    file_id = yield self.collections["files"].register("viruses.json.gz", body, "json")

    return True, {
        "filename": file_id,
        "size": os.path.getsize(self.settings.get("data_path") + "/download/" + file_id)
    }


async def import_file(db, dispatcher, handle, replace=False):

    with gzip.open(handle, "rt") as gzip_file:
        viruses = json.load(gzip_file)

    virus_count = len(viruses)

    duplicates, errors = verify_virus_list(viruses)

    if duplicates or errors:
        document = db.status.find_one_and_update({"_id": "import_viruses"}, {
            "$set": {
                "file_name": None,
                "file_size": 0,
                "added": 0,
                "replaced": 0,
                "skipped": 0,
                "in_progress": False,
                "errors": errors,
                "duplicates": duplicates
            }
        }, return_document=ReturnDocument.AFTER)

        dispatcher.dispatch("status", "update", document)

    # Keeps track of the progress of the import process. Sent to the client intermittently.
    counter = {
        "progress": 0,
        "added": 0,
        "replaced": 0,
        "skipped": 0,
        "warnings": list()
    }

    # Make a list of lowered virus names that are already in use in the database.
    used_names = await db.viruses.distinct("lower_name")

    empty_collection = len(used_names) == 0

    conflicts = await find_import_conflicts(db, viruses, replace)

    if conflicts:
        return False, dict(message="Conflicting sequence ids", conflicts=conflicts)

    used_isolate_ids = set(await db.viruses.distinct("isolates.isolate_id"))

    base_virus_document = {
        "_version": 0,
        "last_indexed_version": 0,
        "modified": False,
        "username": req["session"].user_id,
        "imported": True
    }

    # Lists of pending dispatches. These are sent in batches of ten to avoid overwhelming browsers.
    adds = list()
    replaces = list()

    for i, virus in enumerate(viruses):
        # Calculate the overall progress (how many viruses in the import document have been processed?)
        progress = round((i + 1) / virus_count, 3)

        # Send the current progress data in ``counter`` to the client if the progress has increased by at least
        # 2% since the last report.
        if progress - counter["progress"] > 0.02:
            counter["progress"] = progress
            # transaction.update(counter)

        virus_document, sequences = split_virus(virus)

        to_insert = dict(base_virus_document)

        to_insert.update({key: virus_document[key] for key in ["name", "abbreviation", "isolates"]})

        if empty_collection:
            to_insert["_id"] = await get_new_id(db.viruses)

            dispatches = await insert_from_import(to_insert)

            adds.append(dispatches)

            await db.sequences.insert_many(sequences)

            counter["added"] += 1

            await send_import_dispatches(adds, replaces)

            continue

        lower_name = virus["name"].lower()

        virus_exists = lower_name in used_names

        if virus_exists and not replace:
            counter["skipped"] += 1
            continue

        to_insert["_id"] = await get_new_id(db.viruses)

        # Check if abbreviation exists already.
        virus_with_abbreviation = None

        # Don't count empty strings as duplicate abbreviations!
        if virus["abbreviation"]:
            virus_with_abbreviation = await db.viruses.find_one({"abbreviation": virus["abbreviation"]})

        if virus_with_abbreviation and virus_with_abbreviation["lower_name"] != lower_name:
            # Remove the imported virus's abbreviation because it is already assigned to an existing virus.
            virus["abbreviation"] = ""

            # Record a message for the user.
            counter["warnings"].append(
                "Abbreviation {} already existed for virus {} and was not assigned to new virus {}.".format(
                    virus_with_abbreviation["abbreviation"], virus_with_abbreviation["name"], virus["name"]
                )
            )

        virus_document, sequences = split_virus(virus)

        # Loops through each isolate in the imported virus.
        for isolate in virus_document["isolates"]:
            # Check if the isolate id is already used in the viruses collection.
            if isolate["isolate_id"] in used_isolate_ids:
                # Generate a new isolate id if the imported isolate id is already in the viruses collection.
                isolate["isolate_id"] = await get_new_isolate_id(db, used_isolate_ids)

                # Append the generated isolate to a list of used isolate ids so that is isn't reused during the
                # import process.
                used_isolate_ids.add(isolate["isolate_id"])

        if virus_exists:
            existing_virus = await db.viruses.find_one({"lower_name": lower_name})

            isolate_ids = extract_isolate_ids(existing_virus)

            # Remove the existing virus, including its sequences.
            remove_dispatches = await remove_for_import(
                existing_virus["_id"],
                # transaction.connection.user["_id"]
            )

            # Remove all sequence documents associated with the existing virus.
            await db.sequences.remove({"_id": {
                "$in": isolate_ids
            }})

            counter["replaced"] += 1

        to_insert.update({key: virus_document[key] for key in ["abbreviation", "name", "isolates"]})

        # Add the new virus.
        insert_dispatches = await insert_from_import(to_insert)

        if virus_exists:
            replaces.append((remove_dispatches, insert_dispatches))
        else:
            adds.append(insert_dispatches)

        await db.sequences.insert_many(sequences)

        if not virus_exists:
            counter["added"] += 1

        await send_import_dispatches(adds, replaces)

    await send_import_dispatches(adds, replaces, flush=True)

    counter["progress"] = 1
    # transaction.update(counter)

    return True, counter


def check_virus(virus, sequences):
    """
    Checks that the passed virus and sequences constitute valid Virtool records and can be included in a virus
    index. Error fields are:
    * emtpy_virus - virus has no isolates associated with it.
    * empty_isolate - isolates that have no sequences associated with them.
    * empty_sequence - sequences that have a zero length sequence field.
    * isolate_inconsistency - virus has isolates containing different numbers of sequences.
    
    :param virus: the virus document.
    :param sequences: a list of sequence documents associated with the virus.
    :return: return any errors or False if there are no errors.
    
    """
    errors = {
        "empty_virus": len(virus["isolates"]) == 0,  #
        "empty_isolate": list(),
        "empty_sequence": list(),
        "isolate_inconsistency": False
    }

    isolate_sequence_counts = list()

    # Append the isolate_ids of any isolates without sequences to empty_isolate. Append the isolate_id and sequence
    # id of any sequences that have an empty sequence.
    for isolate in virus["isolates"]:
        isolate_sequences = [sequence for sequence in sequences if sequence["isolate_id"] == isolate["isolate_id"]]
        isolate_sequence_count = len(isolate_sequences)

        if isolate_sequence_count == 0:
            errors["empty_isolate"].append(isolate["isolate_id"])

        isolate_sequence_counts.append(isolate_sequence_count)

        errors["empty_sequence"] += filter(lambda sequence: len(sequence["sequence"]) == 0, isolate_sequences)

    # Give an isolate_inconsistency error the number of sequences is not the same for every isolate. Only give the
    # error if the virus is not also emtpy (empty_virus error).
    errors["isolate_inconsistency"] = (
        len(set(isolate_sequence_counts)) != 1 and not
        (errors["empty_virus"] or errors["empty_isolate"])
    )

    # If there is an error in the virus, return the errors object. Otherwise return False.
    has_errors = False

    for key, value in errors.items():
        if value:
            has_errors = True
        else:
            errors[key] = False

    if has_errors:
        return errors

    return None


def verify_virus_list(viruses):
    fields = ["_id", "name", "abbreviation"]

    seen = {field: set() for field in fields + ["isolate_id", "sequence_id"]}
    duplicates = {field: set() for field in fields + ["isolate_id", "sequence_id"]}

    errors = dict()

    for virus in viruses:

        virus_document, sequences = split_virus(virus)

        errors[virus["name"].lower()] = check_virus(virus_document, sequences)

        for field in fields:

            value = virus[field]

            if field == "abbreviation" and value == "":
                continue

            if field == "name":
                value = value.lower()

            if value in seen[field]:
                duplicates[field].add(value)
            else:
                seen[field].add(value)

        for isolate in virus["isolates"]:
            isolate_id = isolate["isolate_id"]

            if isolate_id in seen:
                duplicates["isolate_id"].add(isolate_id)
            else:
                seen["isolate_id"].add(isolate_id)

            for sequence in isolate["sequences"]:
                sequence_id = sequence["_id"]

                if sequence_id in seen["sequence_id"]:
                    duplicates["sequence_id"].add(sequence_id)
                else:
                    seen["sequence_id"].add(sequence_id)

    if not any(duplicates.values()):
        duplicates = None
    else:
        duplicates = {key: list(duplicates[key]) for key in duplicates}

    if any(errors.values()):
        errors = {key: errors[key] for key in errors if errors[key]}
    else:
        errors = None

    return duplicates, errors


def find_import_conflicts(db, used_name, viruses, replace):

    conflicts = list()

    for virus in viruses:
        lower_name = virus["name"].lower()

        # Check if the virus to be imported already exists in the database using a case-insensitive name comparison.
        virus_exists = lower_name in used_names

        # A list of sequence ids that will be imported along with the virus.
        sequence_ids_to_import = yield extract_sequence_ids(virus)

        # Sequences that already exist in the database and have the same ids as some sequences to be imported.
        already_existing_sequences = yield self.sequences_collection.find(
            {"_id": {"$in": sequence_ids_to_import}},
            ["_id", "isolate_id"]
        ).to_list(length=None)

        if virus_exists:
            # Continue to the next virus if this one cannot be applied to the database.
            if not replace:
                continue

            # The full document of the existing virus.
            existing_virus = yield self.find_one(
                {"lower_name": lower_name},
                ["_id", "name", "isolates"]
            )

            # The isolate ids in the existing virus document.
            existing_isolate_ids = extract_isolate_ids(existing_virus)

            for sequence in already_existing_sequences:
                if not sequence["isolate_id"] in existing_isolate_ids:
                    conflicts.append((existing_virus["_id"], existing_virus["name"], sequence["_id"]))

        else:
            # The virus doesn't already exist but some of its sequence ids are already assigned to other viruses.
            # This is a problem.
            for sequence in already_existing_sequences:
                existing_virus = yield self.find_one({"isolates.isolate_id": sequence["isolate_id"]})
                conflicts.append((existing_virus["_id"], existing_virus["name"], sequence["_id"]))

    return conflicts or None


def send_import_dispatches(self, adds, replaces, flush=False):
    if len(adds) == 30 or flush:
        yield self.dispatch("update", [add[0] for add in adds])
        yield self.collections["history"].dispatch("insert", [add[1] for add in adds])

        del adds[:]

    if len(replaces) == 30 or flush:
        yield self.dispatch("remove", [replace[0][0] for replace in replaces])
        yield self.collections["history"].dispatch("insert", [replace[0][1] for replace in replaces])

        yield self.dispatch("update", [replace[1][0] for replace in replaces])
        yield self.collections["history"].dispatch("insert", [replace[1][1] for replace in replaces])

        del replaces[:]


def insert_from_import(self, virus):
    virus.update({
        "_version": 0,
        "lower_name": virus["name"].lower()
    })

    # Perform the actual database insert operation, retaining the response.
    yield self.db.insert(virus)

    logger.debug("Imported virus {}".format(virus["name"]))

    to_dispatch_virus = yield self.sync_processor([{key: virus[key] for key in self.sync_projector}])

    joined = yield self.join(virus["_id"])

    to_dispatch_history = yield self.collections["history"].add_for_import(
        "insert",
        "add",
        None,  # there is no old document
        joined,
        virus["username"]
    )

    return to_dispatch_virus[0], to_dispatch_history


def remove_for_import(self, virus_id, username):
    # Join the virus.
    virus = yield self.join(virus_id)

    if not virus:
        raise ValueError("No virus associated with _id {}".format(virus_id))

    # Get all the isolate ids from the
    isolate_ids = extract_isolate_ids(virus)

    # Remove all sequences associated with the isolates.
    yield self.sequences_collection.remove({"isolate_id": {"$in": isolate_ids}})

    yield self.db.remove({"_id": virus_id})

    # Put an entry in the history collection saying the virus was removed.
    to_dispatch_history = yield self.collections["history"].add_for_import(
        "remove",
        "remove",
        virus,
        None,
        username
    )

    return virus_id, to_dispatch_history


async def set_last_indexed_version(db, data):
    """
    Called as a result of a request from the index rebuild job. Updates the last indexed version and _version fields
    of all viruses involved in the rebuild when the build completes.

    :param data: the new last_indexed_version and _version fields.
    :return: the response from the update call.

    """
    response = await db.viruses.update({"_id": {"$in": data["ids"]}}, {
        "$set": {
            "last_indexed_version": data["version"],
            "version": data["version"]
        }
    })

    return response


def get_default_isolate(virus, isolate_processor=None):
    """
    Returns the default isolate dict for the given virus document.

    :param virus: a virus document.
    :type virus: dict
    :param isolate_processor: a function to process the default isolate into a desired format.
    :type: func
    :return: the default isolate dict.
    :rtype: dict

    """
    # Get the virus isolates with the default flag set to True. This list should only contain one item.
    default_isolates = [isolate for isolate in virus["isolates"] if virus["default"] is True]

    # Check that there is only one item.
    assert len(default_isolates) == 1

    default_isolate = default_isolates[0]

    if isolate_processor:
        default_isolate = isolate_processor(default_isolate)

    return default_isolate


async def get_new_isolate_id(db, used_isolate_ids=None):
    """
    Generates a unique isolate id.
    
    """
    used_isolate_ids = used_isolate_ids or list()

    used_isolate_ids += await db.viruses.distinct("isolates.isolate_id")

    return random_alphanumeric(8, excluded=set(used_isolate_ids))


def merge_virus(virus, sequences):
    """
    Merge the given sequences in the given virus document. The virus will gain a ``sequences`` field containing a list
    of its associated sequence documents.

    :param virus: a virus document.
    :type virus: dict

    :param sequences: the sequence documents to merge into the virus.
    :type sequences: list

    :return: the merged virus.
    :rtype: dict

    """
    for isolate in virus["isolates"]:
        isolate["sequences"] = [sequence for sequence in sequences if sequence["isolate_id"] == isolate["isolate_id"]]

    return virus


def split_virus(virus):
    """
    Split a merged virus document into a list of sequence documents associated with the virus and a regular virus
    document containing no sequence subdocuments.

    :param virus: the merged virus to split
    :type virus: dict

    :return: a tuple containing the new virus document and a list of sequence documents
    :type: tuple

    """
    sequences = list()

    virus_document = deepcopy(virus)

    for isolate in virus_document["isolates"]:
        sequences += isolate.pop("sequences")

    return virus_document, sequences


def extract_isolate_ids(virus):
    """
    Get the isolate ids from a virus document.

    :param virus: a virus document.
    :return: a list of isolate ids.

    """
    return [isolate["isolate_id"] for isolate in virus["isolates"]]


def find_isolate(isolates, isolate_id):
    """
    Return the isolate identified by ``isolate_id`` from a list of isolates.
    
    :param isolates: a list of isolate dicts
    :type isolates: list
    
    :param isolate_id: the isolate_id of the isolate to return
    :type isolate_id: str
    
    :return: an isolate
    :rtype: dict
    
    """
    return next((isolate for isolate in isolates if isolate["isolate_id"] == isolate_id), None)


def extract_sequence_ids(virus):
    """
    Extract all sequence ids from a merged virus.

    :param virus: the merged virus
    :type virus: dict

    :return: the sequence ids belonging to ``virus``
    :rtype: list

    """
    sequence_ids = list()

    isolates = virus["isolates"]

    if not isolates:
        raise ValueError("Empty isolates list in merged virus")

    for isolate in isolates:
        if "sequences" not in isolate:
            raise KeyError("Isolate in merged virus missing sequences field")

        if not isolate["sequences"]:
            raise ValueError("Empty sequences list in merged virus")

        sequence_ids += [sequence["_id"] for sequence in isolate["sequences"]]

    return sequence_ids


def format_isolate_name(isolate):
    """
    Take a complete or partial isolate ``dict`` and return a readable isolate name.
    
    :param isolate: a complete or partial isolate ``dict`` containing ``source_type`` and ``source_name`` fields.
    :type isolate: dict
    
    :return: an isolate name
    :rtype: str
     
    """
    if isolate["source_type"] is None or isolate["source_name"] is None:
        return "Unnamed isolate"

    return " ".join((isolate["source_type"].capitalize(), isolate["source_name"]))
