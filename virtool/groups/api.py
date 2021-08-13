import pymongo.errors
from aiohttp.web_exceptions import HTTPNoContent, HTTPBadRequest

import virtool.groups.db
import virtool.http.routes
import virtool.validators
from virtool.api.response import json_response, not_found
from virtool.http.schema import schema
from virtool.users.utils import generate_base_permissions
from virtool.utils import base_processor

routes = virtool.http.routes.Routes()


@routes.get("/api/groups")
async def find(req):
    """
    Get a list of all existing group documents.

    """
    cursor = req.app["db"].groups.find()
    return json_response([base_processor(d) async for d in cursor])


@routes.post("/api/groups", admin=True)
@schema({
    "group_id": {
        "type": "string",
        "coerce": virtool.validators.strip,
        "empty": False,
        "required": True
    }
})
async def create(req):
    """
    Adds a new user group.

    """
    db, data = req.app["db"], req["data"]

    document = {
        "_id": data["group_id"].lower(),
        "permissions": generate_base_permissions()
    }

    try:
        await db.groups.insert_one(document)
    except pymongo.errors.DuplicateKeyError:
        raise HTTPBadRequest(text="Group already exists")

    headers = {
        "Location": "/api/groups/" + data["group_id"]
    }

    return json_response(base_processor(document), status=201, headers=headers)


@routes.get("/api/groups/{group_id}")
async def get(req):
    """
    Gets a complete group document.

    """
    document = await req.app["db"].groups.find_one(req.match_info["group_id"])

    if document:
        return json_response(base_processor(document))

    return not_found()


@routes.patch("/api/groups/{group_id}", admin=True)
@schema({
    "permissions": {
        "type": "dict",
        "default": {},
        "check_with": virtool.validators.is_permission_dict
    }
})
async def update_permissions(req):
    """
    Updates the permissions of a given group.

    """
    db = req.app["db"]
    data = req["data"]

    group_id = req.match_info["group_id"]

    old_document = await db.groups.find_one({"_id": group_id}, ["permissions"])

    if not old_document:
        return not_found()

    old_document["permissions"].update(data["permissions"])

    # Get the current permissions dict for the passed group id.
    document = await db.groups.find_one_and_update({"_id": group_id}, {
        "$set": {
            "permissions": old_document["permissions"]
        }
    })

    await virtool.groups.db.update_member_users(db, group_id)

    return json_response(base_processor(document))


@routes.delete("/api/groups/{group_id}", admin=True)
async def remove(req):
    """
    Remove a group.

    """
    db = req.app["db"]

    group_id = req.match_info["group_id"]

    delete_result = await db.groups.delete_one({"_id": group_id})

    if not delete_result.deleted_count:
        return not_found()

    await virtool.groups.db.update_member_users(db, group_id, remove=True)

    raise HTTPNoContent
