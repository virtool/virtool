import json
import gzip
import pymongo
import pymongo.errors
import tempfile

from aiohttp import web
from copy import deepcopy
from pymongo import ReturnDocument
from cerberus import Validator

import virtool.utils
import virtool.virus
import virtool.virus_import
import virtool.virus_history

from virtool.handlers.utils import unpack_request, json_response, not_found, invalid_input, protected, validation,\
    compose_regex_query, paginate, bad_request, no_content


async def find(req):
    """
    Find viruses.

    """
    db = req.app["db"]

    term = req.query.get("term", None)
    modified = req.query.get("modified", None)

    db_query = dict()

    if term:
        db_query.update(compose_regex_query(term, ["name", "abbreviation"]))

    if modified is not None:
        modded = virtool.utils.to_bool(modified)
        db_query["modified"] = modded

    data = await paginate(db.viruses, db_query, req.query, "name", projection=virtool.virus.LIST_PROJECTION)

    data["modified_count"] = await db.viruses.count({"modified": True})

    return json_response(data)


async def get(req):
    """
    Get a complete virus document. Joins the virus document with its associated sequence documents.

    """
    db = req.app["db"]

    virus_id = req.match_info["virus_id"]

    complete = await virtool.virus.get_complete(db, virus_id)

    if not complete:
        return not_found()

    return json_response(complete)


@protected("modify_virus")
@validation({
    "name": {"type": "string", "required": True, "min": 1},
    "abbreviation": {"type": "string", "min": 1}
})
async def create(req):
    """
    Add a new virus to the collection. Checks to make sure the supplied virus name and abbreviation are not already in
    use in the collection. Any errors are sent back to the client.

    """
    db, data = req.app["db"], req["data"]

    # Abbreviation defaults to empty string if not provided.
    abbreviation = data.get("abbreviation", "")

    # Check if either the name or abbreviation are already in use. Send a ``409`` to the client if there is a conflict.
    message = await virtool.virus.check_name_and_abbreviation(db, data["name"], abbreviation)

    if message:
        return json_response({"message": message},  status=409)

    virus_id = await virtool.utils.get_new_id(db.viruses)

    # Start building a virus document.
    data.update({
        "_id": virus_id,
        "abbreviation": abbreviation,
        "last_indexed_version": None,
        "modified": True,
        "lower_name": data["name"].lower(),
        "isolates": [],
        "version": 0
    })

    # Insert the virus document.
    await db.viruses.insert_one(data)

    # Join the virus document into a complete virus record. This will be used for recording history.
    joined = await virtool.virus.join(db, virus_id, data)

    # Build a ``description`` field for the virus creation change document.
    description = "Created {}".format(data["name"])

    # Add the abbreviation to the description if there is one.
    if abbreviation:
        description += " ({})".format(abbreviation)

    await virtool.virus_history.add(
        db,
        "create",
        None,
        joined,
        description,
        req["session"].user_id
    )

    complete = await virtool.virus.get_complete(db, virus_id)

    await req.app["dispatcher"].dispatch(
        "viruses",
        "update",
        virtool.utils.base_processor({key: joined[key] for key in virtool.virus.LIST_PROJECTION})
    )

    return json_response(complete, status=201)


@protected("modify_virus")
@validation({
    "name": {"type": "string"},
    "abbreviation": {"type": "string"}
})
async def edit(req):
    """
    Edit an existing new virus. Checks to make sure the supplied virus name and abbreviation are not already in use in
    the collection.

    """
    db, data = req.app["db"], req["data"]

    virus_id = req.match_info["virus_id"]

    # Get existing complete virus record, at the same time ensuring it exists. Send a ``404`` if not.
    old = await virtool.virus.join(db, virus_id)

    if not old:
        return not_found()

    name_change, abbreviation_change = data.get("name", None), data.get("abbreviation", None)

    if name_change == old["name"]:
        name_change = None

    old_abbreviation = old.get("abbreviation", "")

    if abbreviation_change == old_abbreviation:
        abbreviation_change = None

    # Sent back ``200`` with the existing virus record if no change will be made.
    if name_change is None and abbreviation_change is None:
        return json_response(await virtool.virus.get_complete(db, virus_id))

    # Make sure new name and/or abbreviation are not already in use.
    message = await virtool.virus.check_name_and_abbreviation(db, name_change, abbreviation_change)

    if message:
        return json_response({"message": message}, status=409)

    # Update the ``modified`` field in the virus document now, because we are definitely going to modify the virus.
    data["modified"] = True

    # If the name is changing, update the ``lower_name`` field in the virus document.
    if name_change:
        data["lower_name"] = data["name"].lower()

    # Update the database collection.
    document = await db.viruses.find_one_and_update({"_id": virus_id}, {
        "$set": data,
        "$inc": {
            "version": 1
        }
    }, return_document=ReturnDocument.AFTER)

    # Get a joined version of the new document for recording history.
    new = await virtool.virus.join(db, virus_id, document)

    description = None

    if name_change is not None:
        description = "Changed name to {}".format(new["name"])

        if abbreviation_change is not None:
            # Abbreviation is being removed.
            if abbreviation_change == "" and old_abbreviation:
                description += " and removed abbreviation {}".format(old["abbreviation"])
            # Abbreviation is being added where one didn't exist before
            elif abbreviation_change and not old_abbreviation:
                description += " and added abbreviation {}".format(new["abbreviation"])
            # Abbreviation is being changed from one value to another.
            else:
                description += " and abbreviation to {}".format(new["abbreviation"])

    elif abbreviation_change is not None:
        # Abbreviation is being removed.
        if abbreviation_change == "" and old["abbreviation"]:
            description = "Removed abbreviation {}".format(old_abbreviation)
        # Abbreviation is being added where one didn't exist before
        elif abbreviation_change and not old.get("abbreviation", ""):
            description = "Added abbreviation {}".format(new["abbreviation"])
        # Abbreviation is being changed from one value to another.
        else:
            description = "Changed abbreviation to {}".format(new["abbreviation"])

    await virtool.virus_history.add(
        db,
        "edit",
        old,
        new,
        description,
        req["session"].user_id
    )

    await req.app["dispatcher"].dispatch(
        "viruses",
        "update",
        virtool.utils.base_processor({key: new[key] for key in virtool.virus.LIST_PROJECTION})
    )

    return json_response(await virtool.virus.get_complete(db, virus_id))


@protected("modify_virus")
async def verify(req):
    """
    Verifies that the associated virus is ready to be included in an index rebuild. Returns verification errors if
    necessary.

    * emtpy_virus - virus has no isolates associated with it.
    * empty_isolate - isolates that have no sequences associated with them.
    * empty_sequence - sequences that have a zero length sequence field.
    * isolate_inconsistency - virus has isolates containing different numbers of sequences.

    """
    db = req.app["db"]

    virus_id = req.match_info["virus_id"]

    # Get the virus document of interest.
    joined = await virtool.virus.join(db, virus_id)

    if not joined:
        return not_found()

    errors = {
        "empty_virus": len(joined["isolates"]) == 0,  #
        "empty_isolate": list(),
        "empty_sequence": list(),
        "isolate_inconsistency": False
    }

    isolate_sequence_counts = list()

    # Append the ids of any isolates without sequences to empty_isolate. Append the isolate id and sequence
    # id of any sequences that have an empty sequence.
    for isolate in joined["isolates"]:
        isolate_sequence_count = len(isolate["sequences"])

        isolate_sequence_counts.append(isolate_sequence_count)

        if isolate_sequence_count == 0:
            errors["empty_isolate"].append(isolate["id"])

        errors["empty_sequence"] += [seq["_id"] for seq in isolate["sequences"] if len(seq["sequence"]) == 0]

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
        return json_response({"message": "Verification errors", "errors": errors}, status=400)

    document = await db.viruses.find_one_and_update({"_id": virus_id}, {
        "$set": {
            "modified": False
        },
        "$inc": {
            "version": 1
        }
    }, return_document=ReturnDocument.AFTER)

    new = await virtool.virus.join(db, virus_id, document)

    await virtool.virus_history.add(
        db,
        "verify",
        joined,
        new,
        "Verified",
        req["session"].user_id
    )

    complete = await virtool.virus.get_complete(db, virus_id)

    await req.app["dispatcher"].dispatch(
        "viruses",
        "update",
        virtool.utils.base_processor({key: new[key] for key in virtool.virus.LIST_PROJECTION})
    )

    return json_response(complete)


@protected("modify_virus")
async def remove(req):
    """
    Remove a virus document and its associated sequence documents.

    """
    db = req.app["db"]

    virus_id = req.match_info["virus_id"]

    # Join the virus.
    joined = await virtool.virus.join(db, virus_id)

    if not joined:
        return not_found()

    # Remove all sequences associated with the virus.
    await db.sequences.delete_many({"virus_id": virus_id})

    # Remove the virus document itself.
    await db.viruses.delete_one({"_id": virus_id})

    description = "Removed {}".format(joined["name"])

    if joined["abbreviation"]:
        description += " ({})".format(joined["abbreviation"])

    await virtool.virus_history.add(
        db,
        "remove",
        joined,
        None,
        description,
        req["session"].user_id
    )

    await req.app["dispatcher"].dispatch(
        "viruses",
        "remove",
        [virus_id]
    )

    return web.Response(status=204)


async def list_isolates(req):
    """
    Return a list of isolate records for a given virus.

    """
    db = req.app["db"]

    virus_id = req.match_info["virus_id"]

    document = await virtool.virus.get_complete(db, virus_id)

    if not document:
        return not_found()

    return json_response(document["isolates"])


async def get_isolate(req):
    """
    Get a complete specific isolate subdocument, including its sequences.

    """
    db = req.app["db"]

    virus_id = req.match_info["virus_id"]
    isolate_id = req.match_info["isolate_id"]

    document = await db.viruses.find_one({"_id": virus_id, "isolates.id": isolate_id}, ["isolates"])

    if not document:
        return not_found()

    isolate = dict(virtool.virus.find_isolate(document["isolates"], isolate_id), sequences=[])

    async for sequence in db.sequences.find({"isolate_id": isolate_id}, {"virus_id": False, "isolate_id": False}):
        sequence["id"] = sequence.pop("_id")
        isolate["sequences"].append(sequence)

    return json_response(isolate)


@protected("modify_virus")
@validation(virtool.virus.ISOLATE_SCHEMA)
async def add_isolate(req):
    """
    Add a new isolate to a virus.

    """
    db, data = req.app["db"], req["data"]

    virus_id = req.match_info["virus_id"]

    document = await db.viruses.find_one(virus_id)

    if not document:
        return not_found()

    isolates = deepcopy(document["isolates"])

    # True if the new isolate should be default and any existing isolates should be non-default.
    will_be_default = not isolates or data["default"]

    # Get the complete, joined entry before the update.
    old = await virtool.virus.join(db, virus_id, document)

    # All source types are stored in lower case.
    data["source_type"] = data["source_type"].lower()

    # Get a unique isolate_id for the new isolate.
    isolate_id = await virtool.virus.get_new_isolate_id(db)

    # Set ``default`` to ``False`` for all existing isolates if the new one should be default.
    if isolates and data["default"]:
        for isolate in isolates:
            isolate["default"] = False

    # Force the new isolate as default if it is the first isolate.
    if not isolates:
        data["default"] = True

    # Set the isolate as the default isolate if it is the first one.
    data.update({
        "default": will_be_default,
        "id": isolate_id
    })

    isolates.append(data)

    # Push the new isolate to the database.
    document = await db.viruses.find_one_and_update({"_id": virus_id}, {
        "$set": {
            "isolates": isolates,
            "modified": True
        },
        "$inc": {
            "version": 1
        }
    }, return_document=ReturnDocument.AFTER)

    # Get the joined entry now that it has been updated.
    new = await virtool.virus.join(db, virus_id, document)

    isolate_name = virtool.virus.format_isolate_name(data)

    description = "Added isolate {}".format(isolate_name)

    if will_be_default:
        description += " as default"

    await virtool.virus_history.add(
        db,
        "add_isolate",
        old,
        new,
        description,
        req["session"].user_id
    )

    await virtool.virus.dispatch_version_only(req, new)

    return json_response(dict(data, sequences=[]), status=201)


@protected("modify_virus")
async def edit_isolate(req):
    """
    Edit an existing isolate.

    """
    db, data = await unpack_request(req)

    if not len(data):
        return bad_request("Empty Input")

    v = Validator({
        "source_type": {"type": "string"},
        "source_name": {"type": "string"}
    })

    if not v(data):
        return invalid_input(v.errors)

    data = v.document

    virus_id = req.match_info["virus_id"]
    isolate_id = req.match_info["isolate_id"]

    document = await db.viruses.find_one({"_id": virus_id, "isolates.id": isolate_id})

    if not document:
        return not_found()

    isolates = deepcopy(document["isolates"])

    isolate = virtool.virus.find_isolate(isolates, isolate_id)

    # All source types are stored in lower case.
    if "source_type" in data:
        data["source_type"] = data["source_type"].lower()

    old_isolate_name = virtool.virus.format_isolate_name(isolate)

    isolate.update(data)

    old = await virtool.virus.join(db, virus_id)

    # Replace the isolates list with the update one.
    document = await db.viruses.find_one_and_update({"_id": virus_id}, {
        "$set": {
            "isolates": isolates,
            "modified": True
        },
        "$inc": {
            "version": 1
        }
    }, return_document=ReturnDocument.AFTER)

    # Get the joined entry now that it has been updated.
    new = await virtool.virus.join(db, virus_id, document)

    isolate_name = virtool.virus.format_isolate_name(isolate)

    # Use the old and new entry to add a new history document for the change.
    await virtool.virus_history.add(
        db,
        "edit_isolate",
        old,
        new,
        "Renamed {} to {}".format(old_isolate_name, isolate_name),
        req["session"].user_id
    )

    await virtool.virus.dispatch_version_only(req, new)

    complete = await virtool.virus.get_complete(db, virus_id)

    for isolate in complete["isolates"]:
        if isolate["id"] == isolate_id:
            return json_response(isolate, status=200)


@protected("modify_virus")
async def set_as_default(req):
    """
    Set an isolate as default.

    """
    db, data = await unpack_request(req)

    virus_id = req.match_info["virus_id"]
    isolate_id = req.match_info["isolate_id"]

    document = await db.viruses.find_one({"_id": virus_id, "isolates.id": isolate_id})

    if not document:
        return not_found()

    isolates = deepcopy(document["isolates"])

    # Set ``default`` to ``False`` for all existing isolates if the new one should be default.
    for isolate in isolates:
        isolate["default"] = False

    isolate = virtool.virus.find_isolate(isolates, isolate_id)

    isolate["default"] = True

    if isolates == document["isolates"]:
        complete = await virtool.virus.get_complete(db, virus_id)
        for isolate in complete["isolates"]:
            if isolate["id"] == isolate_id:
                return json_response(isolate)

    old = await virtool.virus.join(db, virus_id)

    # Replace the isolates list with the updated one.
    document = await db.viruses.find_one_and_update({"_id": virus_id}, {
        "$set": {
            "isolates": isolates,
            "modified": True
        },
        "$inc": {
            "version": 1
        }
    }, return_document=ReturnDocument.AFTER)

    # Get the joined entry now that it has been updated.
    new = await virtool.virus.join(db, virus_id, document)

    isolate_name = virtool.virus.format_isolate_name(isolate)

    # Use the old and new entry to add a new history document for the change.
    await virtool.virus_history.add(
        db,
        "set_as_default",
        old,
        new,
        "Set {} as default".format(isolate_name),
        req["session"].user_id
    )

    await virtool.virus.dispatch_version_only(req, new)

    complete = await virtool.virus.get_complete(db, virus_id)

    for isolate in complete["isolates"]:
        if isolate["id"] == isolate_id:
            return json_response(isolate)


@protected("modify_virus")
async def remove_isolate(req):
    """
    Remove an isolate and its sequences from a virus.

    """
    db = req.app["db"]

    virus_id = req.match_info["virus_id"]

    document = await db.viruses.find_one(virus_id)

    if not document:
        return not_found()

    isolates = deepcopy(document["isolates"])

    isolate_id = req.match_info["isolate_id"]

    # Get any isolates that have the isolate id to be removed (only one should match!).
    isolate_to_remove = virtool.virus.find_isolate(isolates, isolate_id)

    # Remove the isolate from the virus' isolate list.
    isolates.remove(isolate_to_remove)

    new_default = None

    # Set the first isolate as default if the removed isolate was the default.
    if isolate_to_remove["default"] and len(isolates):
        new_default = isolates[0]
        new_default["default"] = True

    old = await virtool.virus.join(db, virus_id, document)

    document = await db.viruses.find_one_and_update({"_id": virus_id}, {
        "$set": {
            "isolates": isolates,
            "modified": True
        },
        "$inc": {
            "version": 1
        }
    }, return_document=ReturnDocument.AFTER)

    new = await virtool.virus.join(db, virus_id, document)

    # Remove any sequences associated with the removed isolate.
    await db.sequences.delete_many({"isolate_id": isolate_id})

    description = "Removed {}".format(virtool.virus.format_isolate_name(isolate_to_remove))

    if isolate_to_remove["default"] and new_default:
        description += " and set {} as default".format(virtool.virus.format_isolate_name(new_default))

    await virtool.virus_history.add(
        db,
        "remove_isolate",
        old,
        new,
        description,
        req["session"].user_id
    )

    await virtool.virus.dispatch_version_only(req, new)

    return json_response({
        "virus_id": virus_id,
        "isolate_id": isolate_id
    }, status=204)


async def list_sequences(req):
    db = req.app["db"]

    virus_id = req.match_info["virus_id"]
    isolate_id = req.match_info["isolate_id"]

    if not await db.viruses.find({"_id": virus_id}, {"isolates.id": isolate_id}).count():
        return not_found()

    projection = list(virtool.virus.SEQUENCE_PROJECTION)

    projection.remove("virus_id")
    projection.remove("isolate_id")

    documents = await db.sequences.find({"isolate_id": isolate_id}, projection).to_list(None)

    return json_response([virtool.utils.base_processor(d) for d in documents])


async def get_sequence(req):
    """
    Get a single sequence document by its ``accession`.

    """
    db = req.app["db"]

    sequence_id = req.match_info["sequence_id"]

    document = await db.sequences.find_one(sequence_id, virtool.virus.SEQUENCE_PROJECTION)

    if not document:
        return not_found()

    return json_response(virtool.utils.base_processor(document))


@protected("modify_virus")
@validation({
    "id": {"type": "string", "required": True},
    "definition": {"type": "string", "required": True},
    "host": {"type": "string"},
    "sequence": {"type": "string", "required": True}
})
async def create_sequence(req):
    """
    Create a new sequence record for the given isolate.

    """
    db, data = req.app["db"], req["data"]

    # Extract variables from URL path.
    virus_id, isolate_id = (req.match_info[key] for key in ["virus_id", "isolate_id"])

    # Update POST data to make sequence document.
    data.update({
        "_id": data.pop("id"),
        "virus_id": virus_id,
        "isolate_id": isolate_id,
        "host": data.get("host", "")
    })

    # Get the subject virus document. Will be ``None`` if it doesn't exist. This will result in a ``404`` response.
    document = await db.viruses.find_one({"_id": virus_id, "isolates.id": isolate_id})

    if not document:
        return not_found()

    old = await virtool.virus.join(db, virus_id, document)

    try:
        await db.sequences.insert_one(data)
    except pymongo.errors.DuplicateKeyError:
        return json_response({
            "id": "conflict",
            "message": "Sequence id already exists"
        }, status=409)

    document = await db.viruses.find_one_and_update({"_id": virus_id}, {
        "$set": {
            "modified": True
        },
        "$inc": {
            "version": 1
        }
    }, return_document=ReturnDocument.AFTER)

    new = await virtool.virus.join(db, virus_id, document)

    isolate = virtool.virus.find_isolate(old["isolates"], isolate_id)

    await virtool.virus_history.add(
        db,
        "create_sequence",
        old,
        new,
        "Created new sequence {} in {}".format(data["_id"], virtool.virus.format_isolate_name(isolate)),
        req["session"].user_id
    )

    await virtool.virus.dispatch_version_only(req, new)

    return json_response(virtool.utils.base_processor(data))


@protected("modify_virus")
@validation({
    "host": {"type": "string"},
    "definition": {"type": "string"},
    "sequence": {"type": "string"}
})
async def edit_sequence(req):
    db, data = req.app["db"], req["data"]

    if not len(data):
        return bad_request("Empty Input")

    virus_id, isolate_id, sequence_id = (req.match_info[key] for key in ["virus_id", "isolate_id", "sequence_id"])

    document = await db.viruses.find_one({"_id": virus_id, "isolates.id": isolate_id})

    if not document:
        return not_found("Virus or isolate not found")

    old = await virtool.virus.join(db, virus_id, document)

    updated_sequence = await db.sequences.find_one_and_update({"_id": sequence_id}, {
        "$set": data
    }, return_document=ReturnDocument.AFTER)

    if not updated_sequence:
        return not_found("Sequence not found")

    document = await db.viruses.find_one_and_update({"_id": virus_id}, {
        "$set": {
            "modified": True
        },
        "$inc": {
            "version": 1
        }
    }, return_document=ReturnDocument.AFTER)

    new = await virtool.virus.join(db, virus_id, document)

    isolate = virtool.virus.find_isolate(old["isolates"], isolate_id)

    await virtool.virus_history.add(
        db,
        "edit_sequence",
        old,
        new,
        "Edited sequence {} in {}".format(sequence_id, virtool.virus.format_isolate_name(isolate)),
        req["session"].user_id
    )

    await virtool.virus.dispatch_version_only(req, new)

    return json_response(virtool.utils.base_processor(updated_sequence))


async def remove_sequence(req):
    """
    Remove a sequence from an isolate.

    """
    db = req.app["db"]

    virus_id = req.match_info["virus_id"]
    sequence_id = req.match_info["sequence_id"]

    document = await db.sequences.find_one(sequence_id, ["isolate_id"])

    if not document:
        return not_found()

    old = await virtool.virus.join(db, virus_id)

    if not old:
        return not_found()

    isolate = virtool.virus.find_isolate(old["isolates"], document["isolate_id"])

    await db.viruses.update_one({"_id": virus_id}, {
        "$set": {
            "modified": True
        },
        "$inc": {
            "version": 1
        }
    })

    new = await virtool.virus.join(db, virus_id)

    isolate_name = virtool.virus.format_isolate_name(isolate)

    await virtool.virus_history.add(
        db,
        "remove_sequence",
        old,
        new,
        "Removed sequence {} from {}".format(sequence_id, isolate_name),
        req["session"].user_id
    )

    await virtool.virus.dispatch_version_only(req, new)

    return no_content()


async def list_history(req):
    db = req.app["db"]

    virus_id = req.match_info["virus_id"]

    if not await db.viruses.find({"_id": virus_id}).count():
        return not_found()

    documents = await db.history.find({"virus.id": virus_id}).to_list(None)

    return json_response(documents)


@protected("modify_virus")
async def upload(req):
    db = req.app["db"]

    reader = await req.multipart()

    import_file = await reader.next()

    document = await db.status.find_one_and_update({"_id": "import_viruses"}, {
        "$set": {
            "file_name": import_file.filename,
            "file_size": 0,
            "virus_count": 0,
            "in_progress": True,
            "progress": 0,
            "inserted": 0,
            "replaced": 0,
            "skipped": 0,
            "errors": None,
            "duplicates": None,
            "conflicts": None,
            "warnings": []
        }
    }, return_document=ReturnDocument.AFTER, upsert=True)

    await req.app["dispatcher"].dispatch("status", "update", document)

    handle = tempfile.TemporaryFile()

    while True:
        chunk = await import_file.read_chunk()

        if not chunk:
            break

        document = await db.status.find_one_and_update({"_id": "import_viruses"}, {
            "$inc": {
                "file_size": len(chunk)
            }
        }, return_document=ReturnDocument.AFTER, projection=["_id", "file_size"])

        await req.app["dispatcher"].dispatch("status", "update", document)

        handle.write(chunk)

    handle.seek(0)

    await virtool.virus_import.import_file(req.app["db"], req.app["settings"], handle)

    return json_response({"message": "Accepted. Check '/api/status' for more info."}, status=202)


async def export(req):
    """
    Export all viruses and sequences as a gzipped JSON string. Made available as a downloadable file named
    ``viruses.json.gz``.

    """
    db = req.app["db"]

    # A list of joined viruses.
    virus_list = list()

    async for document in db.viruses.find({"last_indexed_version": {"ne": None}}):
        # If the virus has been changed since the last index rebuild, patch it to its last indexed version.
        if document["version"] != document["last_indexed_version"]:
            _, joined, _ = await virtool.virus_history.patch_virus_to_version(
                db,
                document["_id"],
                document["last_indexed_version"]
            )

        virus_list.append(joined)

    # Convert the list of viruses to a JSON-formatted string.
    json_string = json.dumps(virus_list)

    # Compress the JSON string with gzip.
    body = gzip.compress(bytes(json_string, "utf-8"))

    return web.Response(
        headers={"Content-Disposition": "attachment; filename='viruses.json.gz'"},
        content_type="application/gzip",
        body=body
    )
