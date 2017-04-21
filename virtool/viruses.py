import re
import asyncio
import logging
import json
import gzip

from pprint import pprint
from copy import deepcopy
from pymongo import ReturnDocument

import virtool.history
import virtool.utils

from virtool.data_utils import get_new_id, format_doc_id
from virtool.handlers.status import status_processor
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
    """
    The base processor for virus documents. Calls :func:`~.format_doc_id` and returns the result.
    
    :param document: the document to process
    :type document: dict
    
    :return: the processed document
    :rtype: dict
         
    """
    return format_doc_id("virus", dict(document))


def dispatch_version_only(req, new):
    """
    Dispatch a virus update. Should be called when the document itself is not being modified.
    
    :param req: the request object
    
    :param new: the virus document
    :type new: dict
    
    """
    req.app["dispatcher"].dispatch(
        "viruses",
        "update",
        processor({key: new[key] for key in LIST_PROJECTION})
    )


def sequence_processor(document):
    """
    Process a sequence document to send it to a client.
    
    :param document: the document to process
    :type document: dict
    
    :return: the processed document
    :rtype: dict
     
    """
    document = dict(document)
    document["accession"] = document.pop("_id")

    return document


async def join(db, virus_id, document=None):
    """
    Join the virus associated with the supplied virus id with its sequences. If a virus entry is also passed, the
    database will not be queried for the virus based on its id.
    
    :param db: the application database client
    :type db: :class:`~motor.motor_asyncio.AsyncIOMotorClient`

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
    """
    Check is a virus name and abbreviation are already in use in the database. Returns a message if the ``name`` or
    ``abbreviation`` are already in use. Returns ``False`` if they are not in use.
    
    :param db: the application database client
    :type db: :class:`~motor.motor_asyncio.AsyncIOMotorClient`
    
    :param name: a virus name
    :type name: str
    
    :param abbreviation: a virus abbreviation
    :type abbreviation: str
     
    :return: a message or ``False``
    :rtype: str or bool
    
    """
    unique_name = not (name and await db.viruses.find({"name": re.compile(name, re.IGNORECASE)}).count())
    unique_abbreviation = not (abbreviation and await db.viruses.find({"abbreviation": abbreviation}).count())

    if not unique_name and not unique_abbreviation:
        return "Name and abbreviation already exist"

    if not unique_name:
        return "Name already exists"

    if not unique_abbreviation:
        return "Abbreviation already exists"

    return False


async def import_file(loop, db, dispatch, handle, user_id, replace=False):
    """
    
    :param loop: the application IO loop

    :param db: the application database client
    :type db: :class:`~motor.motor_asyncio.AsyncIOMotorClient`

    :param dispatch: the dispatcher's dispatch function
    :type dispatch: func

    :param handle: the temporary file handle for the file to import
    :type handle: :class:`~.TemporaryFile`

    :param user_id: the requesting ``user_id``
    :type user_id: str

    :param replace: should viruses existing in the database be replaced by ones in the import file 
    :type replace: bool

    """
    viruses = await loop.run_in_executor(None, load_import_file, handle)

    virus_count = len(viruses)

    document = await db.status.find_one_and_update({"_id": "import_viruses"}, {
        "$set": {
            "virus_count": virus_count
        }
    }, return_document=ReturnDocument.AFTER)

    dispatch("status", "update", status_processor(document))

    duplicates, errors = verify_virus_list(viruses)

    # If there are problems in the import file, report them to the status collection and stop the import.
    if duplicates or errors:
        document = await db.status.find_one_and_update({"_id": "import_viruses"}, {
            "$set": {
                "in_progress": False,
                "errors": errors,
                "duplicates": duplicates
            }
        }, return_document=ReturnDocument.AFTER)

        dispatch("status", "update", status_processor(document))

        return

    # Make a list of lowered virus names that are already in use in the database.
    used_names = await db.viruses.distinct("lower_name")

    conflicts = await find_import_conflicts(db, viruses, replace, used_names=used_names)

    if conflicts:
        document = await db.status.find_one_and_update({"_id": "import_viruses"}, {
            "$set": {
                "in_progress": False,
                "errors": errors,
                "duplicates": duplicates,
                "conflicts": conflicts
            }
        }, return_document=ReturnDocument.AFTER)

        dispatch("status", "update", status_processor(document))

        return

    empty_collection = len(used_names) == 0

    # Keeps track of the progress of the import process. Sent to the client intermittently.
    counter = {
        "progress": 0,
        "inserted": 0,
        "replaced": 0,
        "skipped": 0,
        "warnings": list()
    }

    used_isolate_ids = set(await db.viruses.distinct("isolates.isolate_id"))

    base_virus_document = {
        "last_indexed_version": 0,
        "modified": False,
        "user_id": user_id,
        "imported": True
    }

    # Lists of pending dispatches. These are batched to avoid overwhelming clients.
    insertions = list()
    replacements = list()

    for i, virus in enumerate(viruses):
        # Calculate the overall progress (how many viruses in the import document have been processed?)
        progress = round((i + 1) / virus_count, 3)

        # Send the current progress data in ``counter`` to the client if the progress has increased by at least
        # 2% since the last report.
        if progress - counter["progress"] > 0.02:
            counter["progress"] = progress

            document = await db.status.find_one_and_update({"_id": "import_viruses"}, {
                "$set": counter
            }, return_document=ReturnDocument.AFTER)

            dispatch("status", "update", status_processor(document))

        virus_document, sequences = split_virus(virus)

        to_insert = dict(base_virus_document)

        to_insert.update({key: virus_document[key] for key in ["name", "abbreviation", "isolates"]})

        # If the collection was empty when the import started, do not bother considering replacement.
        if empty_collection:
            to_insert["_id"] = await get_new_id(db.viruses)

            insertions.append(await insert_from_import(db, to_insert, user_id))

            await db.sequences.insert_many(sequences)

            counter["inserted"] += 1

            send_import_dispatches(dispatch, insertions, replacements)

            continue

        lower_name = virus["name"].lower()

        virus_exists = lower_name in used_names

        # Do nothing if the virus exists and replacement is disabled. Increment ``skipped`` counter by one.
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

        # Loops through each isolate in the imported virus, replacing isolate_ids if they are not unique.
        for isolate in virus_document["isolates"]:
            # Check if the isolate id is already used in the viruses collection.
            if isolate["isolate_id"] in used_isolate_ids:
                # Generate a new isolate id if the imported isolate id is already in the viruses collection.
                isolate["isolate_id"] = await get_new_isolate_id(db, used_isolate_ids)

                # Append the generated isolate to a list of used isolate ids so that is isn't reused during the
                # import process.
                used_isolate_ids.add(isolate["isolate_id"])

        # In this case, do a replacement by removing the existing virus and inserting a new virus document.
        if virus_exists:
            existing_virus = await db.viruses.find_one({"lower_name": lower_name})

            # Remove the existing virus, including its sequences.
            remove_dispatches = await delete_for_import(
                existing_virus["_id"],
                # transaction.connection.user["_id"]
            )

            # Remove all sequence documents associated with the existing virus.
            await db.sequences.remove({"_id": {
                "$in": extract_isolate_ids(existing_virus)
            }})

            counter["replaced"] += 1

        to_insert.update({key: virus_document[key] for key in ["abbreviation", "name", "isolates"]})

        # Add the new virus.
        insert_dispatches = await insert_from_import(to_insert)

        if virus_exists:
            replacements.append((remove_dispatches, insert_dispatches))
        else:
            insertions.append(insert_dispatches)

        await db.sequences.insert_many(sequences)

        if not virus_exists:
            counter["inserted"] += 1

        send_import_dispatches(dispatch, insertions, replacements)

    # Flush any remaining messages to the dispatcher.
    send_import_dispatches(dispatch, insertions, replacements, flush=True)

    counter["progress"] = 1

    document = await db.status.find_one_and_update({"_id": "import_viruses"}, {
        "$set": counter
    }, return_document=ReturnDocument.AFTER)

    dispatch("status", "update", status_processor(document))

    return counter


def load_import_file(handle):
    """
    Load a list of merged virus documents from a file handle associated with a Virtool ``viruses.json.gz`` file.
    
    :param handle: the handle for a importable file
    
    :return: list of merged virus documents
    :rtype: list
    
    """
    # Open GZIP file and parse JSON into dict.
    with gzip.open(handle, "rt") as gzip_file:
        data = json.load(gzip_file)

    # Close the temporary handle. It isn't closed by the calling handler function.
    handle.close()

    return data


def check_virus(virus, sequences):
    """
    Checks that the passed virus and sequences constitute valid Virtool records and can be included in a virus
    index. Error fields are:
    * emtpy_virus - virus has no isolates associated with it.
    * empty_isolate - isolates that have no sequences associated with them.
    * empty_sequence - sequences that have a zero length sequence field.
    * isolate_inconsistency - virus has isolates containing different numbers of sequences.
    
    :param virus: the virus document
    :type virus: dict
    
    :param sequences: a list of sequence documents associated with the virus.
    :type sequences: list
    
    :return: return any errors or False if there are no errors.
    :rtype: dict or NoneType
    
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


async def find_import_conflicts(db, viruses, replace, used_names=None):

    used_names = used_names or list()

    conflicts = list()

    for virus in viruses:

        lower_name = virus["name"].lower()

        # Check if the virus to be imported already exists in the database using a case-insensitive name comparison.
        virus_exists = lower_name in used_names

        # A list of sequence ids that will be imported along with the virus.
        sequence_ids_to_import = extract_sequence_ids(virus)

        # Sequences that already exist in the database and have the same ids as some sequences to be imported.
        already_existing_sequences = await db.sequences.find(
            {"_id": {"$in": sequence_ids_to_import}},
            ["_id", "isolate_id"]
        ).to_list(length=None)

        if virus_exists:
            # Continue to the next virus if this one cannot be applied to the database.
            if not replace:
                continue

            # The full document of the existing virus.
            existing_virus = await db.viruses.find_one(
                {"lower_name": lower_name},
                ["_id", "name", "isolates"]
            )

            # The isolate ids in the existing virus document.
            existing_isolate_ids = extract_isolate_ids(existing_virus)

            for sequence in already_existing_sequences:
                if not sequence["isolate_id"] in existing_isolate_ids:
                    conflicts.append((existing_virus["_id"], existing_virus["name"], sequence["_id"]))

        else:
            # The virus doesn't already exist but some of its sequence ids are already assigned to other viruses. This
            # is a problem.
            for sequence in already_existing_sequences:
                existing = await db.viruses.find_one({"isolates.isolate_id": sequence["isolate_id"]}, ["_id", "name"])
                conflicts.append((existing["_id"], existing["name"], sequence["_id"]))

    return conflicts or None


def send_import_dispatches(dispatch, insertions, replacements, flush=False):
    """
    Dispatch all possible insertion and replacement messages for a running virus reference import. Called many times
    during an import process.
    
    :param dispatch: the dispatch function
    :type dispatch: func
    
    :param insertions: a list of tuples describing insertions
    :type insertions: list
    
    :param replacements: a list of tuples describing replacements and their component removals and an insertions 
    :type replacements: list
    
    :param flush: override the length check and flush all data to the dispatcher
    :type flush: bool
     
    """

    if len(insertions) == 30 or (flush and insertions):
        virus_updates, history_updates = zip(*insertions)

        dispatch("viruses", "update", virus_updates)
        dispatch("history", "update", history_updates)

        del insertions[:]

    if len(replacements) == 30 or (flush and replacements):
        dispatch("viruses", "remove", [replace[0][0] for replace in replacements])
        dispatch("history", "update", [replace[0][1] for replace in replacements])

        dispatch("viruses", "update", [replace[1][0] for replace in replacements])
        dispatch("history", "update", [replace[1][1] for replace in replacements])

        del replacements[:]


async def insert_from_import(db, virus_document, user_id):
    """
    :param db: the application database client
    :type db: :class:`~motor.motor_asyncio.AsyncIOMotorClient`
    
    :param virus_document: the virus document to add
    :type virus_document: dict
    
    :param user_id: the requesting ``user_id``
    :type user_id: str
    
    """
    virus_document.update({
        "version": 0,
        "modified": True,
        "last_indexed_version": None,
        "lower_name": virus_document["name"].lower()
    })

    # Perform the actual database insert operation, retaining the response.
    await db.viruses.insert(virus_document)

    to_dispatch = processor({key: virus_document[key] for key in LIST_PROJECTION})

    joined = await join(db, virus_document["_id"])

    change = await virtool.history.add(
        db,
        "create",
        None,
        joined,
        ("Created virus ", virus_document["name"], virus_document["_id"]),
        user_id
    )

    change_to_dispatch = virtool.history.processor({key: change[key] for key in virtool.history.DISPATCH_PROJECTION})

    return to_dispatch, change_to_dispatch


async def delete_for_import(db, virus_id, user_id):
    """
    Delete a virus document and its sequences as part of an import process.
    
    :param db: the application database client
    :type db: :class:`~motor.motor_asyncio.AsyncIOMotorClient`
    
    :param virus_id: the ``virus_id`` to remove
    :type virus_id: str
    
    :param user_id: the requesting ``user_id``
    :type user_id: str
     
    """
    joined = await join(db, virus_id)

    if not joined:
        raise ValueError("Could not find virus_id {}".format(virus_id))

    # Perform database operations.
    await db.sequences.delete_many({"isolate_id": {"$in": extract_isolate_ids(joined)}})

    await db.viruses.delete_one({"_id": virus_id})

    # Put an entry in the history collection saying the virus was removed.
    change = await virtool.history.add(
        db,
        "remove",
        joined,
        None,
        ("Removed virus", joined["name"], joined["_id"]),
        user_id
    )

    change_to_dispatch = virtool.history.processor({key: change[key] for key in virtool.history.DISPATCH_PROJECTION})

    return virus_id, change_to_dispatch


async def update_last_indexed_version(db, virus_ids, version):
    """
    Called from a index rebuild job. Updates the last indexed version and _version fields
    of all viruses involved in the rebuild when the build completes.
    
    :param db: the application database client
    :type db: :class:`~motor.motor_asyncio.AsyncIOMotorClient`
    
    :param virus_ids: a list the ``virus_id`` of each virus to update
    :type virus_ids: list
    
    :param version: the value to set for the viruses ``version`` and ``last_indexed_version`` fields
    :type: int
    
    :return: the Pymongo update result
    :rtype: :class:`~pymongo.results.UpdateResult`

    """
    result = await db.viruses.update({"_id": {"$in": virus_ids}}, {
        "$set": {
            "last_indexed_version": version,
            "version": version
        }
    })

    return result


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
    default_isolates = [isolate for isolate in virus["isolates"] if isolate["default"] is True]

    if len(default_isolates) > 1:
        raise ValueError("Found more than one default isolate")

    if len(default_isolates) == 0:
        raise ValueError("No default isolate found")

    default_isolate = default_isolates[0]

    if isolate_processor:
        default_isolate = isolate_processor(default_isolate)

    return default_isolate


async def get_new_isolate_id(db, excluded=None):
    """
    Generates a unique isolate id.
    
    """
    used_isolate_ids = excluded or list()

    used_isolate_ids += await db.viruses.distinct("isolates.isolate_id")

    return virtool.utils.random_alphanumeric(8, excluded=set(used_isolate_ids))


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
    if not isolate["source_type"] or not isolate["source_name"]:
        return "Unnamed Isolate"

    return " ".join((isolate["source_type"].capitalize(), isolate["source_name"]))
