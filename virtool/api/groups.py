import logging

import pymongo.errors
from pymongo import ReturnDocument

import virtool.db.groups
import virtool.db.users
import virtool.users
import virtool.utils
from virtool.api.utils import bad_request, conflict, json_response, not_found, no_content, protected, validation

logger = logging.getLogger(__name__)


@protected("manage_users")
async def find(req):
    """
    Get a list of all existing group documents.

    """
    documents = await req.app["db"].groups.find().to_list(None)

    return json_response([virtool.utils.base_processor(d) for d in documents])


@protected("manage_users")
@validation({
    "group_id": {
        "type": "string",
        "required": True,
        "minlength": 1
    }
})
async def create(req):
    """
    Adds a new user group.

    """
    db, data = req.app["db"], req["data"]

    document = {
        "_id": data["group_id"].lower(),
        "permissions": {permission: False for permission in virtool.users.PERMISSIONS}
    }

    try:
        await db.groups.insert_one(document)
    except pymongo.errors.DuplicateKeyError:
        return conflict("Group already exists")

    headers = {
        "Location": "/api/groups/" + data["group_id"]
    }

    return json_response(virtool.utils.base_processor(document), status=201, headers=headers)


@protected("manage_users")
async def get(req):
    """
    Gets a complete group document.

    """
    document = await req.app["db"].groups.find_one(req.match_info["group_id"])

    if document:
        return json_response(virtool.utils.base_processor(document))

    return not_found()


@protected("manage_users")
@validation({key: {"type": "boolean"} for key in virtool.users.PERMISSIONS})
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
    document = await db.groups.find_one_and_update({"_id": group_id}, {
        "$set": {
            "permissions": old_document["permissions"]
        }
    }, return_document=ReturnDocument.AFTER)

    await virtool.db.groups.update_member_users(db, group_id)

    return json_response(virtool.utils.base_processor(document))


@protected("manage_users")
async def remove(req):
    """
    Remove a group.

    """
    db = req.app["db"]

    group_id = req.match_info["group_id"]

    # The administrator is not permitted to be removed.
    if group_id == "administrator":
        return bad_request("Cannot remove administrator group")

    document = await db.groups.find_one_and_delete({"_id": group_id})

    if not document:
        return not_found()

    await virtool.db.groups.update_member_users(db, group_id, remove=True)

    return no_content()
