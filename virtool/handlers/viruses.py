from copy import deepcopy
from pymongo import ReturnDocument
from cerberus import Validator

import virtool.data_utils
import virtool.viruses

from virtool.handlers.utils import unpack_json_request, json_response, bad_request, not_found, invalid_input, protected
from virtool.viruses import processor, dispatch_projection, check_name_and_abbreviation, join, extract_isolate_ids


async def find(req):
    documents = await req.app["db"].viruses.find({}, dispatch_projection).to_list(length=10)
    return json_response([processor(document) for document in documents])


async def get(req):
    """
    Get a complete virus document. Joins the virus document with its associated sequence documents.

    """
    db = req.app["db"]

    virus_id = req.match_info["virus_id"]

    joined = await join(db, virus_id)

    if not joined:
        return not_found()

    return json_response(processor(joined))


@protected("modify_virus")
async def create(req):
    """
    Adds a new virus to the collection. Checks to make sure the supplied virus name and abbreviation are not already in
    use in the collection. Any errors are sent back to the client.

    """
    db, data = await unpack_json_request(req)

    v = Validator({
        "name": {"type": "string", "required": True},
        "abbreviation": {"type": "string"}
    })

    if not v(data):
        return invalid_input(v.errors)

    unique_name, unique_abbreviation = await check_name_and_abbreviation(db, data["name"], data["abbreviation"])

    if not unique_name and not unique_abbreviation:
        return json_response({"message": "Name and abbreviation already exist"}, status=409)

    if not unique_name:
        return json_response({"message": "Name already exists"}, status=409)

    if not unique_abbreviation:
        return json_response({"message": "Abbreviation already exists"}, status=409)

    data.update({
        "_id": await virtool.data_utils.get_new_id(db.viruses),
        "user_id": req["session"].user_id,
        "last_indexed_version": None,
        "modified": True,
        "lower_name": data["name"].lower(),
        "isolates": []
    })

    await db.viruses.insert_one(data)

    '''

    await db.history.add(
        "insert",
        "add",
        None,  # there is no old document
        joined,
        virus["username"]
    )
    
    '''

    return json_response(processor(data), status=201)


@protected("modify_virus")
async def edit(req):
    """
    Edit an existing new virus. Checks to make sure the supplied virus name and abbreviation are not already in use in
    the collection.

    """
    db, data = await unpack_json_request(req)

    if not data:
        return bad_request("Empty input")

    v = Validator({
        "name": {"type": "string"},
        "abbreviation": {"type": "string"}
    })

    if not v(data):
        return invalid_input(v.errors)

    virus_id = req.match_info["virus_id"]

    old = await join(db, virus_id)

    if not old:
        return not_found()

    unique_name, unique_abbreviation = await check_name_and_abbreviation(db, data["name"], data["abbreviation"])

    if not unique_name and not unique_abbreviation:
        return json_response({"message": "Name and abbreviation already exist"}, status=409)

    if not unique_name:
        return json_response({"message": "Name already exists"}, status=409)

    if not unique_abbreviation:
        return json_response({"message": "Abbreviation already exists"}, status=409)

    if "name" in data:
        data["lower_name"] = data["name"].lower()

    data["modified"] = True

    document = await db.viruses.find_one_and_update({"_id": virus_id}, {
        "$set": data
    }, return_document=ReturnDocument.AFTER)

    new = await join(db, virus_id, document)

    '''
    await db.history.add(
        "insert",
        "add",
        old,
        new,
        virus["username"]
    )

    '''

    return json_response(processor(new), status=200)


@protected("modify_virus")
async def remove(req):
    """
    Remove a virus document and its associated sequence documents.

    """
    db = req.app["db"]

    virus_id = req.match_info["virus_id"]

    # Join the virus.
    joined = await join(db, virus_id)

    if not joined:
        return not_found()

    # Remove all sequences associated with the isolates.
    await db.sequences.delete_many({"isolate_id": {"$in": extract_isolate_ids(joined)}})

    # Remove the virus document itself.
    await db.viruses.delete_one({"_id": virus_id})

    '''
    # Put an entry in the history collection saying the virus was removed.
    await db.history.add(
        "remove",
        "remove",
        joined,
        None,
        user_id
    )    
    '''

    return json_response({"removed": virus_id})


async def list_isolates(req):
    """
    Returns a list of isolate records for a given virus. 
     
    """
    db = req.app["db"]

    virus_id = req.match_info["virus_id"]

    document = await db.viruses.find_one(virus_id, ["isolates"])

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

    document = await db.viruses.find_one({"_id": virus_id, "isolates.isolate_id": isolate_id}, ["isolates"])

    if not document:
        return not_found()

    isolate = [isolate for isolate in document["isolates"] if isolate["isolate_id"] == isolate_id][0]

    isolate["sequences"] = await db.sequences.find({"isolate_id": isolate["isolate_id"]}).to_list(None)

    return json_response(isolate)


@protected("modify_virus")
async def add_isolate(req):
    """
    Add a new isolate to a virus.

    """
    db, data = await unpack_json_request(req)

    v = Validator({
        "source_type": {"type": "string", "default": ""},
        "source_name": {"type": "string", "default": ""},
        "default": {"type": "boolean", "default": False}
    })

    if not v(data):
        return invalid_input(v.errors)

    data = v.document

    virus_id = req.match_info["virus_id"]

    # Get the complete, joined entry before the update.
    old = await join(db, virus_id)

    if not old:
        return not_found()

    # All source types are stored in lower case.
    data["source_type"] = data["source_type"].lower()

    # Get a unique isolate_id for the new isolate.
    isolate_id = await virtool.viruses.get_new_isolate_id(db)

    # True if the new isolate should be default and any existing isolates should be non-default.
    will_be_default = not old["isolates"] or data["default"]

    isolates = deepcopy(old["isolates"])

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
        "isolate_id": isolate_id,
        "sequences": []
    })

    isolates.append(data)

    # Push the new isolate to the database.
    document = await db.viruses.find_one_and_update({"_id": virus_id}, {
        "$set": {
            "isolates": isolates,
            "modified": True
        }
    }, return_document=ReturnDocument.AFTER)

    # Get the joined entry now that it has been updated.
    new = await join(db, virus_id, document)

    '''
    # Use the old and new entry to add a new history document for the change.
    await db.history["history"].add(
        "update",
        "add_isolate",
        old,
        new,
        req["session"].user_id
    )
    '''

    return json_response(data, status=201)


@protected("modify_virus")
async def edit_isolate(req):
    """
    Edit an existing isolate.

    """
    db, data = await unpack_json_request(req)

    if not data:
        return bad_request("Empty input")

    v = Validator({
        "source_type": {"type": "string"},
        "source_name": {"type": "string"},
        "default": {"type": "boolean", "allowed": [True]}
    })

    if not v(data):
        return invalid_input(v.errors)

    data = v.document

    virus_id = req.match_info["virus_id"]
    isolate_id= req.match_info["isolate_id"]

    # Get the complete, joined entry before the update.
    old = await join(db, virus_id)

    if not old:
        return not_found()

    # All source types are stored in lower case.
    if "source_type" in data:
        data["source_type"] = data["source_type"].lower()

    isolates = deepcopy(old["isolates"])

    # Set ``default`` to ``False`` for all existing isolates if the new one should be default.
    if data.get("default", False):
        for isolate in isolates:
            isolate["default"] = False

    isolate = next((isolate for isolate in isolates if isolate["isolate_id"] == isolate_id), None)

    isolate.update(data)

    # Push the new isolate to the database.
    document = await db.viruses.find_one_and_update({"_id": virus_id}, {
        "$set": {
            "isolates": isolates,
            "modified": True
        }
    }, return_document=ReturnDocument.AFTER)

    # Get the joined entry now that it has been updated.
    new = await join(db, virus_id, document)

    '''
    # Use the old and new entry to add a new history document for the change.
    await db.history["history"].add(
        "update",
        "edit_isolate",
        old,
        new,
        req["session"].user_id
    )
    '''

    return json_response(isolate, status=200)

'''

async def update(req):
    """
    Set either the abbreviation or name field in the virus document identified by the the supplied virus id. Checks that
    the abbreviation or name is not used elsewhere in the collection and adds a history document describing the change.

    """
    db, data = await unpack_json_request(req)

    virus_id = req.match_info["virus_id"]

    # Make sure valid fields are being updated.
    valid_fields = ["abbreviation", "name"]

    if not all(field in valid_fields for field in data):
        return web.json_response({"Invalid field(s)"}, status=400)

    document = await viruses.join(db, virus_id)

    if not document:
        return web.json_response({"Not found"}, status=404)

    exists = {
        "name": False,
        "abbreviation": False
    }

    for field in exists:
        if field in data and data[field]:
            exists[field] = await db.viruses.find({field: data[field]})

    if exists["name"] and exists["abbreviation"]:
        return web.json_response({"Name and abbreviation already exist"})

    if exists["name"]:
        return web.json_response({"Name already exists"}, status=400)

    if exists["abbreviation"]:
        return web.json_response({"Abbreviation already exists"}, status=400)

    set_dict = dict(data, modified=True)

    if "name" in set_dict:
        set_dict["lower_name"] = set_dict["name"].lower()

    new = await db.viruses.update({"_id": virus_id}, {
        "$set": update
    }, return_document=ReturnDocument.AFTER)

    # Add a history record describing the change.
    await history.add(
        db,
        "update",
        "set_field",
        document,
        await viruses.join(db, virus_id, new),
        req["session"]["user_id"]
    )

    return web.json_response(viruses.to_client(new))





async def add_isolate(req):
    """
    Update or insert a virus isolate. If no isolate_id is included in the data passed from the client, a new isolate
    will be created.

    """
    db, data = await unpack_json_request(req)

    new_isolate = data["new"]

    # All source types are stored in lower case.
    new_isolate["source_type"] = new_isolate["source_type"].lower()

    # Get the existing isolates from the database.
    isolates = yield self.get_field(data["_id"], "isolates")

    # Get the complete, joined entry before the update.
    old = yield self.join(data["_id"])

    # If the update dict contains an isolate id field, update the matching isolate in the virus document. The
    # provided isolate id must already exist in the virus, otherwise the method will fail.
    if "isolate_id" in new_isolate:
        isolate_id = new_isolate.pop("isolate_id")

        # Set to True when and if the included isolate id is found in the viruses isolates list.
        found_isolate_id = False

        # Go through the virus' isolates until a matching isolate id is found. If a match is not found.
        for isolate in isolates:
            if isolate["isolate_id"] == isolate_id:
                isolate.update(new_isolate)
                found_isolate_id = True
                break

        # Check that the isolate id already exists in the virus, before updating.
        if found_isolate_id:
            yield self.update(data["_id"], {
                "$set": {
                    "isolates": isolates,
                    "modified": True
                }
            })

        # Fail if the isolate update contains an isolate id not found in the virus.
        else:

            logger.warning("User {} attempted to update isolate with non-existent isolate id".format(
                transaction.connection.user["_id"]
            ))
            return False, {"error": "Invalid isolate id."}

    # If no isolate id is included in the upsert dict, we assume we are adding a new isolate.
    else:
        # Get a unique isolate_id for the new isolate.
        isolate_id = yield self.get_new_isolate_id()

        # Set the isolate as the default isolate if it is the first one.
        new_isolate.update({
            "default": len(isolates) == 0,
            "isolate_id": isolate_id,
        })

        # Push the new isolate to the database.
        yield self.update(data["_id"], {
            "$push": {"isolates": new_isolate},
            "$set": {"modified": True}
        })

    # Get the joined entry now that it has been updated.
    new = yield self.join(data["_id"])

    # Use the old and new entry to add a new history document for the change.
    yield self.collections["history"].add(
        "update",
        "upsert_isolate",
        old,
        new,
        transaction.connection.user["_id"]
    )

    return True, {"isolate_id": isolate_id}


async def update_isolate(req):
    """
    Update or insert a virus isolate. If no isolate_id is included in the data passed from the client, a new isolate
    will be created.

    """
    db, data = unpack_json_request(req)

    new_isolate = data["new"]

    # All source types are stored in lower case.
    new_isolate["source_type"] = new_isolate["source_type"].lower()

    # Get the existing isolates from the database.
    isolates = yield self.get_field(data["_id"], "isolates")

    # Get the complete, joined entry before the update.
    old = yield self.join(data["_id"])

    # If the update dict contains an isolate id field, update the matching isolate in the virus document. The
    # provided isolate id must already exist in the virus, otherwise the method will fail.
    if "isolate_id" in new_isolate:
        isolate_id = new_isolate.pop("isolate_id")

        # Set to True when and if the included isolate id is found in the viruses isolates list.
        found_isolate_id = False

        # Go through the virus' isolates until a matching isolate id is found. If a match is not found.
        for isolate in isolates:
            if isolate["isolate_id"] == isolate_id:
                isolate.update(new_isolate)
                found_isolate_id = True
                break

        # Check that the isolate id already exists in the virus, before updating.
        if found_isolate_id:
            yield self.update(data["_id"], {
                "$set": {
                    "isolates": isolates,
                    "modified": True
                }
            })

        # Fail if the isolate update contains an isolate id not found in the virus.
        else:

            logger.warning("User {} attempted to update isolate with non-existent isolate id".format(
                transaction.connection.user["_id"]
            ))
            return False, {"error": "Invalid isolate id."}

    # If no isolate id is included in the upsert dict, we assume we are adding a new isolate.
    else:
        # Get a unique isolate_id for the new isolate.
        isolate_id = yield self.get_new_isolate_id()

        # Set the isolate as the default isolate if it is the first one.
        new_isolate.update({
            "default": len(isolates) == 0,
            "isolate_id": isolate_id,
        })

        # Push the new isolate to the database.
        yield self.update(data["_id"], {
            "$push": {"isolates": new_isolate},
            "$set": {"modified": True}
        })

    # Get the joined entry now that it has been updated.
    new = yield self.join(data["_id"])

    # Use the old and new entry to add a new history document for the change.
    yield self.collections["history"].add(
        "update",
        "upsert_isolate",
        old,
        new,
        transaction.connection.user["_id"]
    )

    return True, {"isolate_id": isolate_id}


async def remove_isolate(req):
    """
    Remove an isolate from a virus document given a virus id and isolate id.

    """
    db = req.app["db"]

    user_id = req["session"]["user_id"]
    virus_id = req.match_info["virus_id"]
    isolate_id = req.match_info["isolate_id"]

    document = await db.viruses.find_one({"isolates.isolate_id": isolate_id})

    isolates = document["isolates"]

    if not document:
        return web.json_response({"message": "Not found"}, status=404)

    # Get any isolates that have the isolate id to be removed (only one should match!).
    isolates_to_remove = [isolate for isolate in isolates if isolate["isolate_id"] == isolate_id]

    # Make sure the isolate is unique within the virus.
    assert len(isolates_to_remove) == 1

    # The isolate that will be removed.
    isolate_to_remove = isolates_to_remove[0]

    # Remove the isolate from the virus' isolate list.
    isolates.remove(isolate_to_remove)

    # Set the first isolate as default if the removed isolate was the default.
    if isolate_to_remove["default"]:
        for i, isolate in enumerate(isolates):
            isolate["default"] = (i == 0)

    old = await viruses.join(db, virus_id, document=document)

    document = await db.viruses.find_one_and_update({"_id": virus_id}, {
        "$set": {
            "isolates": isolates,
            "modified": True
        }
    }, return_document=ReturnDocument.AFTER)

    new = await viruses.join(db, virus_id, document=document)

    # Remove any sequences associated with the removed isolate.
    await db.sequences.remove({"isolate_id": isolate_id})

    await db.history.add(
        "update",
        "remove_isolate",
        old,
        new,
        user_id
    )

    return web.json_response(viruses.to_client(document))


async def authorize_upload(req):
    db, data = await unpack_json_request(req)

    file_id = await db.files.register(
        name=data["name"],
        size=data["size"],
        file_type="viruses"
    )

    return web.json_response({"file_id": file_id})
'''