import json
import gzip
from pymongo import ReturnDocument

import virtool.virus
import virtool.virus_history
import virtool.utils
import virtool.errors


def load_import_file(path):
    """
    Load a list of merged virus documents from a file handle associated with a Virtool ``viruses.json.gz`` file.

    :param path: the path to the viruses.json.gz file
    :type path: str

    :return: the virus data to import
    :rtype: dict

    """
    with open(path, "rb") as handle:
        with gzip.open(handle, "rt") as gzip_file:
            return json.load(gzip_file)


async def import_data(db, dispatch, data, user_id):
    """
    Import a previously exported Virtool virus reference.

    :param db: the application database client
    :type db: :class:`~motor.motor_asyncio.AsyncIOMotorClient`

    :param dispatch: the dispatcher's dispatch function
    :type dispatch: func

    :param data: the virus data to import
    :type data: dict

    :param user_id: the requesting ``user_id``
    :type user_id: str

    """
    viruses = data["data"]

    await db.status.replace_one({"_id": "virus_import"}, {"_id": "virus_import"}, upsert=True)

    document = await db.status.find_one_and_update({"_id": "virus_import"}, {
        "$set": {
            "version": data["version"],
            "file_created_at": data["created_at"]
        }
    }, return_document=ReturnDocument.AFTER)

    await dispatch("status", "update", virtool.utils.base_processor(document))

    duplicates, errors = verify_virus_list(viruses)

    if duplicates or errors:
        document = await db.status.find_one_and_update({"_id": "virus_import"}, {
            "$set": {
                "errors": errors,
                "duplicates": duplicates
            }
        }, return_document=ReturnDocument.AFTER)

        return await dispatch("status", "update", virtool.utils.base_processor(document))

    isolate_counts = list()
    sequence_counts = list()

    for virus in viruses:
        isolates = virus["isolates"]
        isolate_counts.append(len(isolates))
        
        for isolate in isolates:
            sequence_counts.append(len(isolate["sequences"]))

    document = await db.status.find_one_and_update({"_id": "virus_import"}, {
        "$set": {
            "inserted": 0,
            "totals": {
                "viruses": len(viruses),
                "isolates": sum(isolate_counts),
                "sequences": sum(sequence_counts)
            }
        }
    }, return_document=ReturnDocument.AFTER)

    await dispatch("status", "update", virtool.utils.base_processor(document))

    _virus_buffer = list()
    _sequence_buffer = list()

    for virus in viruses:
        document, sequences = virtool.virus.split_virus(virus)

        document.update({
            "lower_name": document["name"].lower(),
            "last_indexed_version": None,
            "created_at": virtool.utils.timestamp(),
            "version": 0
        })

        _virus_buffer.append(document)

        for sequence in sequences:
            _sequence_buffer.append(sequence)

        if len(_virus_buffer) == 50:
            await db.viruses.insert_many(_virus_buffer)

            document = await db.status.find_one_and_update({"_id": "virus_import"}, {
                "$inc": {
                    "inserted": 50,
                }
            }, return_document=ReturnDocument.AFTER)

            await dispatch("status", "update", virtool.utils.base_processor(document))

            _virus_buffer = list()

        if len(_sequence_buffer) == 50:
            await db.sequences.insert_many(_sequence_buffer)
            _sequence_buffer = list()

    virus_buffer_length = len(_virus_buffer)

    if virus_buffer_length:
        await db.viruses.insert_many(_virus_buffer)

        document = await db.status.find_one_and_update({"_id": "virus_import"}, {
            "$inc": {
                "inserted": virus_buffer_length,
            }
        }, return_document=ReturnDocument.AFTER)

        await dispatch("status", "update", virtool.utils.base_processor(document))

    if len(_sequence_buffer):
        await db.sequences.insert_many(_sequence_buffer)

    for virus in viruses:
        # Join the virus document into a complete virus record. This will be used for recording history.
        joined = await virtool.virus.join(db, virus["_id"])

        # Build a ``description`` field for the virus creation change document.
        description = "Created {}".format(joined["name"])

        abbreviation = document.get("abbreviation", None)

        # Add the abbreviation to the description if there is one.
        if abbreviation:
            description += " ({})".format(abbreviation)

        await virtool.virus_history.add(
            db,
            "create",
            None,
            joined,
            description,
            user_id
        )

    await dispatch("status", "update", virtool.utils.base_processor(document))


def verify_virus_list(viruses):
    fields = ["_id", "name", "abbreviation"]

    seen = {field: set() for field in fields + ["isolate_id", "sequence_id"]}
    duplicates = {field: set() for field in fields + ["isolate_id", "sequence_id"]}

    errors = dict()

    for joined in viruses:

        # Check for problems local to the virus document.
        errors[joined["name"].lower()] = virtool.virus.check_virus(joined)

        # Check for problems in the list as a whole.
        for field in fields:
            value = joined[field]

            if field == "abbreviation" and value == "":
                continue

            if field == "name":
                value = value.lower()

            if value in seen[field]:
                duplicates[field].add(value)
            else:
                seen[field].add(value)

        for isolate in joined["isolates"]:
            if "isolate_id" in isolate:
                isolate["id"] = isolate.pop("isolate_id")

            isolate_id = isolate["id"]

            if isolate_id in seen:
                duplicates["isolate_id"].add(isolate_id)
            else:
                seen["isolate_id"].add(isolate_id)

            for sequence in isolate["sequences"]:
                sequence_id = sequence.get("id", sequence["_id"])

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


async def check_import_abbreviation(db, virus_document, lower_name=None):
    """
    Check if the abbreviation for a virus document to be imported already exists in the database. If the abbreviation
    exists, set the ``abbreviation`` field in the virus document to an empty string and return warning text to
    send to the client.
    
    :param db: the application database client
    :type db: :class:`~motor.motor_asyncio.AsyncIOMotorClient`
    
    :param virus_document: the virus document that is being imported
    :type virus_document: dict
    
    :param lower_name: the name of the virus coerced to lowercase
    :type lower_name: str
     
    """
    lower_name = lower_name or virus_document["name"].lower()

    # Check if abbreviation exists already.
    virus_with_abbreviation = None

    # Don't count empty strings as duplicate abbreviations!
    if virus_document["abbreviation"]:
        virus_with_abbreviation = await db.viruses.find_one({"abbreviation": virus_document["abbreviation"]})

    if virus_with_abbreviation and virus_with_abbreviation["lower_name"] != lower_name:
        # Remove the imported virus's abbreviation because it is already assigned to an existing virus.
        virus_document["abbreviation"] = ""

        # Record a message for the user.
        return "Abbreviation {} already existed for virus {} and was not assigned to new virus {}.".format(
            virus_with_abbreviation["abbreviation"], virus_with_abbreviation["name"], virus_document["name"]
        )

    return None


async def send_import_dispatches(dispatch, insertions, replacements, flush=False):
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

        await dispatch("viruses", "update", virus_updates)
        await dispatch("history", "update", history_updates)

        del insertions[:]

    if len(replacements) == 30 or (flush and replacements):
        await dispatch("viruses", "remove", [replace[0][0] for replace in replacements])
        await dispatch("history", "update", [replace[0][1] for replace in replacements])

        await dispatch("viruses", "update", [replace[1][0] for replace in replacements])
        await dispatch("history", "update", [replace[1][1] for replace in replacements])

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
    # Modified is set to ``False`` so the user does not have to verify every single imported virus.
    virus_document.update({
        "version": 0,
        "last_indexed_version": None,
        "lower_name": virus_document["name"].lower(),
        "imported": True,
        "verified": False
    })

    # Perform the actual database insert operation, retaining the response.
    await db.viruses.insert_one(virus_document)

    issues = await virtool.virus.verify(db, virus_document["_id"], virus_document)

    if issues is None:
        await db.viruses.update_one({"_id": virus_document["_id"]}, {
            "$set": {
                "verified": True
            }
        })

        virus_document["verified"] = True

    to_dispatch = virtool.utils.base_processor({key: virus_document[key] for key in virtool.virus.LIST_PROJECTION})

    joined = await virtool.virus.join(db, virus_document["_id"])

    change = await virtool.virus_history.add(
        db,
        "create",
        None,
        joined,
        "Created {}".format(virus_document["name"]),
        user_id
    )

    change_to_dispatch = {key: change[key] for key in virtool.virus_history.LIST_PROJECTION}

    change_to_dispatch = virtool.utils.base_processor(change_to_dispatch)

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
    joined = await virtool.virus.join(db, virus_id)

    if not joined:
        raise ValueError("Could not find virus_id {}".format(virus_id))

    # Perform database operations.
    await db.sequences.delete_many({"isolate_id": {"$in": virtool.virus.extract_isolate_ids(joined)}})

    await db.viruses.delete_one({"_id": virus_id})

    # Put an entry in the history collection saying the virus was removed.
    change = await virtool.virus_history.add(
        db,
        "remove",
        joined,
        None,
        "Removed",
        user_id
    )

    change_to_dispatch = {key: change[key] for key in virtool.virus_history.LIST_PROJECTION}

    change_to_dispatch = virtool.utils.base_processor(change_to_dispatch)

    return virus_id, change_to_dispatch
