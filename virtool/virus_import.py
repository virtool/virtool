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

    :param handle: the handle for a importable file

    :return: list of merged virus documents
    :rtype: list

    """
    with open(path, "rb") as handle:
        with gzip.open(handle, "rt") as gzip_file:
            return json.load(gzip_file)


async def import_data(db, dispatch, data, user_id, replace):
    """
    Import a previously exported Virtool virus reference.

    :param loop: the application IO loop

    :param db: the application database client
    :type db: :class:`~motor.motor_asyncio.AsyncIOMotorClient`

    :param dispatch: the dispatcher's dispatch function
    :type dispatch: func

    :param user_id: the requesting ``user_id``
    :type user_id: str

    :param replace: should viruses existing in the database be replaced by ones in the import file 
    :type replace: bool

    """
    virus_count = len(data)

    document = await db.status.find_one_and_update({"_id": "virus_import"}, {
        "$set": {
            "virus_count": virus_count
        }
    }, return_document=ReturnDocument.AFTER)

    await dispatch("status", "update", virtool.utils.base_processor(document))

    duplicates, errors = verify_virus_list(data)

    if duplicates or errors:
        raise

    # Make a list of lowered virus names that are already in use in the database.
    used_names = await db.viruses.distinct("lower_name")

    # Set the variable to ``True`` if the viruses collection is empty.
    empty_collection = len(used_names) == 0

    # If the viruses collection is empty, remove any extraneous sequence documents.
    if empty_collection:
        await db.sequences.delete_many({})

    # Only check for ``sequence_id`` conflicts if the collection is not empty.
    else:
        conflicts = await find_import_conflicts(db, data, used_names)

        if conflicts:
            document = await db.status.find_one_and_update({"_id": "virus_import"}, {
                "$set": {
                    "in_progress": False,
                    "conflicts": conflicts
                }
            }, return_document=ReturnDocument.AFTER)

            await dispatch("status", "update", virtool.utils.base_processor(document))

            return

    # Keeps track of the progress of the import process. Intermittently saved to database and dispatched to clients.
    counter = {
        "progress": 0,
        "inserted": 0,
        "replaced": 0,
        "skipped": 0,
        "warnings": list()
    }

    used_isolate_ids = set(await db.viruses.distinct("isolates.id"))

    base_virus_document = {
        "last_indexed_version": 0,
        "user": {
            "id": user_id
        },
        "imported": True
    }

    # Lists of pending dispatches. These are batched to avoid overwhelming clients.
    insertions = list()
    replacements = list()

    # Iterate through virus to be imported.
    for i, virus in enumerate(data):
        # Calculate the overall progress (how many viruses in the import document have been processed?)
        progress = round((i + 1) / virus_count, 3)

        # Send the current progress data in ``counter`` to the client if the progress has increased by at least
        # 2% since the last report.
        if progress - counter["progress"] > 0.02:
            counter["progress"] = progress

            document = await db.status.find_one_and_update({"_id": "virus_import"}, {
                "$set": counter
            }, return_document=ReturnDocument.AFTER)

            dispatch("status", "update", virtool.utils.base_processor(document))

        virus_document, sequences = virtool.virus.split_virus(virus)

        to_insert = dict(base_virus_document)

        to_insert.update({key: virus_document[key] for key in ["name", "abbreviation", "isolates"]})

        # If the collection was empty when the import started, do not bother considering replacement.
        if empty_collection:
            to_insert["_id"] = await virtool.utils.get_new_id(db.viruses)

            insertions.append(await insert_from_import(db, to_insert, user_id))

            await db.sequences.insert_many(sequences)

            counter["inserted"] += 1

            await send_import_dispatches(dispatch, insertions, replacements)

            continue

        lower_name = virus["name"].lower()

        virus_exists = lower_name in used_names

        # Do nothing if the virus exists and replacement is disabled. Increment ``skipped`` counter by one.
        if virus_exists and not replace:
            counter["skipped"] += 1
            continue

        to_insert["_id"] = await virtool.utils.get_new_id(db.viruses)

        virus_document, sequences = virtool.virus.split_virus(virus)

        # Loops through each isolate in the imported virus, replacing isolate_ids if they are not unique.
        for isolate in virus_document["isolates"]:
            # Check if the isolate id is already used in the viruses collection.
            if isolate["id"] in used_isolate_ids:
                # Generate a new isolate id if the imported isolate id is already in the viruses collection.
                isolate["id"] = await virtool.virus.get_new_isolate_id(db, used_isolate_ids)

                # Append the generated isolate to a list of used isolate ids so that is isn't reused during the
                # import process.
                used_isolate_ids.add(isolate["id"])

        # In this case, do a replacement by removing the existing virus and inserting a new virus document.
        if virus_exists:
            existing_virus = await db.viruses.find_one({"lower_name": lower_name})

            # Remove the existing virus, including its sequences.
            remove_dispatches = await delete_for_import(
                existing_virus["_id"]
            )

            # Remove all sequence documents associated with the existing virus.
            await db.sequences.delete_many({"_id": {
                "$in": virtool.virus.extract_isolate_ids(existing_virus)
            }})

            counter["replaced"] += 1

        to_insert.update({key: virus_document[key] for key in ["abbreviation", "name", "isolates"]})

        # Add the new virus.
        insert_dispatches = await insert_from_import(db, to_insert, user_id)

        if virus_exists:
            replacements.append((remove_dispatches, insert_dispatches))
        else:
            insertions.append(insert_dispatches)

        await db.sequences.insert_many(sequences)

        if not virus_exists:
            counter["inserted"] += 1

        await send_import_dispatches(dispatch, insertions, replacements)

    # Flush any remaining messages to the dispatcher.
    await send_import_dispatches(dispatch, insertions, replacements, flush=True)

    counter["progress"] = 1

    document = await db.status.find_one_and_update({"_id": "virus_import"}, {
        "$set": counter
    }, return_document=ReturnDocument.AFTER)

    dispatch("status", "update", virtool.utils.base_processor(document))


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
