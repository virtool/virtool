import logging
import pymongo.errors

from aiohttp import web
from pymongo import ReturnDocument
from virtool.groups import projection, processor, update_member_users
from virtool.permissions import PERMISSIONS

logger = logging.getLogger(__name__)

async def find(req):
    """
    Get a list of all existing group documents.
     
    """
    documents = await req.app["db"].groups.find({}, projection).to_list(None)
    return web.json_response([processor(d) for d in documents])


async def create(req):
    """
    Adds a new user group.

    """
    try:
        group_id = (await req.json())["group_id"]
    except KeyError:
        return web.json_response({"message": "Missing group_id"}, status=400)

    if not isinstance(group_id, str):
        return web.json_response({"message": "Wrong type for group_id"}, status=400)

    document = {
        "_id": (await req.json())["group_id"],
        "permissions": {permission: False for permission in PERMISSIONS}
    }

    try:
        await req.app["db"].groups.insert(document)
    except pymongo.errors.DuplicateKeyError:
        return web.json_response({"message": "Group already exists"}, status=400)

    return web.json_response(processor(document))


async def get(req):
    """
    Gets a complete group document.
    
    """
    document = await req.app["db"].groups.find_one(req.match_info["group_id"], projection)

    if document:
        return web.json_response(processor(document))

    return web.json_response({"message": "Not found"}, status=404)


async def update_permissions(req):
    """
    Updates the permissions of a given group.
    
    """
    group_id = req.match_info["group_id"]
    permissions = await req.json()

    if permissions == {} or not all([key in PERMISSIONS for key in permissions.keys()]):
        return web.json_response(({"message": "Invalid key"}), status=400)

    old_document = await req.app["db"].groups.find_one({"_id": group_id}, ["permissions"])

    if not old_document:
        return web.json_response({"message": "Not found"}, status=404)

    old_document["permissions"].update(permissions)

    # Get the current permissions dict for the passed group id.
    document = await req.app["db"].groups.find_one_and_update({"_id": group_id}, {
        "$set": {
            "permissions": old_document["permissions"]
        }
    }, return_document=ReturnDocument.AFTER)

    document["group_id"] = document.pop("_id")

    return web.json_response(document)


async def remove(req):
    """
    Remove a group.

    """
    group_id = req.match_info["group_id"]

    print("group_id", group_id)

    # Only accept single id strings.
    if not isinstance(group_id, str):
        return web.json_response({"message": "Invalid type"}, status=400)

    # The administrator is not permitted to be removed.
    if group_id == "administrator":
        return web.json_response({"message": "Cannot remove administrator group"}, status=400)

    document = await req.app["db"].groups.find_one_and_delete({"_id": group_id})

    if not document:
        return web.json_response({"message": "Not found"}, status=404)

    await update_member_users(req.app["db"], group_id, remove=True)

    return web.json_response({"removed": group_id})
