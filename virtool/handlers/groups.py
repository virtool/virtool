import logging
import pymongo.errors

from pymongo import ReturnDocument
from virtool.user_groups import projection, processor, update_member_users
from virtool.user_permissions import PERMISSIONS
from virtool.handlers.utils import json_response, bad_request, not_found, protected, validation

logger = logging.getLogger(__name__)


@protected("manage_users")
async def find(req):
    """
    Get a list of all existing group documents.
     
    """
    documents = await req.app["db"].groups.find({}, projection).to_list(None)

    return json_response([processor(d) for d in documents])


@protected("manage_users")
@validation({
    "group_id": {
        "type": "string",
        "required": True
    }
})
async def create(req):
    """
    Adds a new user group.

    """
    db, data = req.app["db"], req["data"]

    document = {
        "_id": data["group_id"],
        "permissions": {permission: False for permission in PERMISSIONS}
    }

    try:
        await db.groups.insert(document)
    except pymongo.errors.DuplicateKeyError:
        return json_response({"message": "Group already exists"}, status=409)

    return json_response(processor(document))


@protected("manage_users")
async def get(req):
    """
    Gets a complete group document.
    
    """
    document = await req.app["db"].groups.find_one(req.match_info["group_id"], projection)

    if document:
        return json_response(processor(document))

    return not_found()


@protected("manage_users")
@validation({key: dict(type="boolean") for key in PERMISSIONS})
async def update_permissions(req):
    """
    Updates the permissions of a given group.
    
    """
    db, data = req.app["db"], req["data"]

    group_id = req.match_info["group_id"]

    old_document = await db.groups.find_one({"_id": group_id}, ["permissions"])

    if not old_document:
        return not_found()

    old_document["permissions"].update(data)

    # Get the current permissions dict for the passed group id.
    document = await req.app["db"].groups.find_one_and_update({"_id": group_id}, {
        "$set": {
            "permissions": old_document["permissions"]
        }
    }, return_document=ReturnDocument.AFTER)

    document["group_id"] = document.pop("_id")

    return json_response(document)


@protected("manage_users")
async def remove(req):
    """
    Remove a group.

    """
    group_id = req.match_info["group_id"]

    # Only accept single id strings.
    if not isinstance(group_id, str):
        return bad_request("Invalid type")

    # The administrator is not permitted to be removed.
    if group_id == "administrator":
        return bad_request("Cannot remove administrator group")

    document = await req.app["db"].groups.find_one_and_delete({"_id": group_id})

    if not document:
        return not_found()

    await update_member_users(req.app["db"], group_id, remove=True)

    return json_response({"removed": group_id})
