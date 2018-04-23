import pymongo.errors
from pymongo import ReturnDocument

import virtool.db.groups
import virtool.db.users
import virtool.http.routes
import virtool.users
import virtool.utils
from virtool.api.utils import conflict, json_response, not_found, no_content, protected, validation

routes = virtool.http.routes.Routes()


@routes.get("/api/groups")
async def find(req):
    """
    Get a list of all existing group documents.

    """
    documents = await req.app["db"].groups.find().to_list(None)

    return json_response([virtool.utils.base_processor(d) for d in documents])


@routes.post("/api/groups", admin=True, schema={
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
    key: {"type": "boolean"} for key in virtool.users.PERMISSIONS
})
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


@routes.delete("/api/groups/{group_id}", admin=True)
async def remove(req):
    """
    Remove a group.

    """
    db = req.app["db"]

    group_id = req.match_info["group_id"]

    document = await db.groups.find_one_and_delete({"_id": group_id})

    if not document:
        return not_found()

    await virtool.db.groups.update_member_users(db, group_id, remove=True)

    return no_content()
