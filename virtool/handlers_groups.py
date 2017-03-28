import logging
import pymongo.errors

from aiohttp import web
from pymongo import ReturnDocument
from virtool.data.groups import update_member_users
from virtool.permissions import PERMISSIONS

logger = logging.getLogger(__name__)

projector = ["_id", "_version", "permissions"]


async def find(req):
    """
    Get a list of all existing group documents.
     
    """
    documents = await req["db"].find().to_list(None)
    return web.json_response(documents)


async def create(req):
    """
    Adds a new user group.

    """
    try:
        group_id = (await req.json())["group_id"]
        permissions = {permission: False for permission in PERMISSIONS}

        await req["db"].users.insert({
            "_id": group_id,
            "permissions": permissions
        })

        return web.json_response({
            "group_id": group_id,
            "permissions": permissions
        })

    except pymongo.errors.DuplicateKeyError:
        return web.json_response({"message": "Group already exists"}, status=400)


async def get(req):
    """
    Gets a complete group document.
    
    """
    document = await req["db"].find_one(req.match_info["group_id"])

    if document:
        return web.json_response(document)

    return web.json_response({"message": "Not found"}, status=404)


async def update_permissions(req):
    """
    Updates the permissions of a given group.
    
    """
    group_id = req.match_info["group_id"]
    permissions = (await req.json())["permissions"]

    # Get the current permissions dict for the passed group id.
    document = await req["db"].groups.update({"_id": group_id}, {"group.permissions": {
        "$set": permissions
    }}, return_document=ReturnDocument.AFTER)

    document["group_id"] = document.pop("_id")

    return web.json_response(document)


async def remove(req):
    """
    Remove a group.

    """
    group_id = req.match_info["group_id"]

    # Only accept single id strings.
    if not isinstance(group_id, str):
        return web.json_response({"message": "Only one user group can be removed per call."}, status=400)

    # The administrator is not permitted to be removed.
    if group_id == "administrator":
        return web.json_response({"message": "Administrator group cannot be removed."}, status=400)

    if await req["db"].groups.find({"_id": group_id}).count():
        return web.json_response({"message": "Group {} does not exist.".format(group_id)}, status=400)

    await update_member_users(req["db"], group_id, remove=True)

    await req["db"].groups.remove({"_id": group_id})

    return web.json_response({"group_id": group_id})
