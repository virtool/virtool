import pymongo.errors

import virtool.db.groups
import virtool.db.users
import virtool.http.routes
import virtool.users
import virtool.utils
import virtool.validators
from virtool.api.utils import bad_request, json_response, no_content, not_found

routes = virtool.http.routes.Routes()


@routes.get("/api/groups")
async def find(req):
    """
    Get a list of all existing group documents.

    """
    cursor = req.app["db"].groups.find()
    return json_response([virtool.utils.base_processor(d) async for d in cursor])


@routes.post("/api/groups", admin=True, schema={
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
        "permissions": {permission: False for permission in virtool.users.PERMISSIONS}
    }

    try:
        await db.groups.insert_one(document)
    except pymongo.errors.DuplicateKeyError:
        return bad_request("Group already exists")

    headers = {
        "Location": "/api/groups/" + data["group_id"]
    }

    return json_response(virtool.utils.base_processor(document), status=201, headers=headers)


@routes.get("/api/groups/{group_id}")
async def get(req):
    """
    Gets a complete group document.

    """
    document = await req.app["db"].groups.find_one(req.match_info["group_id"])

    if document:
        return json_response(virtool.utils.base_processor(document))

    return not_found()


@routes.patch("/api/groups/{group_id}", admin=True, schema={
    "permissions": {
        "type": "dict",
        "default": {},
        "validator": virtool.validators.is_permission_dict
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

    await virtool.db.groups.update_member_users(db, group_id)

    return json_response(virtool.utils.base_processor(document))


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

    await virtool.db.groups.update_member_users(db, group_id, remove=True)

    return no_content()
