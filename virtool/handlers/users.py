import hashlib
from pymongo import ReturnDocument

import virtool.user
import virtool.utils
import virtool.user_groups
from virtool.user_permissions import PERMISSIONS
from virtool.handlers.utils import protected, no_content, bad_request, invalid_input, unpack_request, json_response,\
    not_found, validation


@protected("manage_users")
async def find(req):
    """
    Get a list of all user documents in the database.

    """
    users = await req.app["db"].users.find({}, virtool.user.PROJECTION).to_list(None)

    return json_response([virtool.utils.base_processor(user) for user in users])


@protected("manage_users")
async def get(req):
    """
    Get a near-complete user document. Password data are removed.

    """
    document = await req.app["db"].users.find_one(req.match_info["user_id"], virtool.user.PROJECTION)

    if not document:
        return not_found()

    return json_response(virtool.utils.base_processor(document))


@protected("manage_users")
@validation({
    "user_id": {"type": "string", "required": True},
    "password": {"type": "string", "required": True},
    "force_reset": {"type": "boolean"}
})
async def create(req):
    """
    Add a new user to the user database.

    """
    db, data = req.app["db"], req["data"]

    user_id = data["user_id"]

    # Check if the username is already taken. Fail if it does.
    if await virtool.user.user_exists(db, user_id):
        return json_response({
            "id": "conflict",
            "message": "User already exists"
        }, status=409)

    document = {
        "_id": user_id,
        # A list of group _ids the user is associated with.
        "groups": list(),
        "settings": {
            "skip_quick_analyze_dialog": True,
            "show_ids": True,
            "show_versions": True,
            "quick_analyze_algorithm": "pathoscope_bowtie"
        },
        "identicon": hashlib.sha256(data["user_id"].encode()).hexdigest(),
        "sessions": [],
        "permissions": {permission: False for permission in PERMISSIONS},
        "password": virtool.user.hash_password(data["password"]),
        "primary_group": "",
        # Should the user be forced to reset their password on their next login?
        "force_reset": data.get("force_reset", True),
        # A timestamp taken at the last password change.
        "last_password_change": virtool.utils.timestamp(),
        # Should all of the user's sessions be invalidated so that they are forced to login next time they
        # download the client.
        "invalidate_sessions": False
    }

    await db.users.insert_one(document)

    headers = {
        "Location": "/api/users/" + user_id
    }

    return json_response(
        virtool.utils.base_processor({key: document[key] for key in virtool.user.PROJECTION}),
        headers=headers,
        status=201
    )


@protected("manage_users")
@validation({
    "force_reset": {"type": "boolean"},
    "password": {"type": "string"},
    "primary_group": {"type": "string"}
})
async def edit(req):
    db, data = req.app["db"], req["data"]

    user_id = req.match_info["user_id"]

    if not await virtool.user.user_exists(db, user_id):
        return not_found("User not found")

    update = dict()

    if "primary_group" in data:
        primary_group = data["primary_group"]

        if primary_group != "none":
            if not await db.groups.count({"_id": primary_group}):
                return not_found("Group not found")

            if not await db.users.count({"_id": user_id, "groups": primary_group}):
                return bad_request("User is not member of group: {}".format(primary_group))

        update.update({
            "primary_group": primary_group
        })

    if "password" in data:
        update.update({
            "password": virtool.user.hash_password(data["password"]),
            "last_password_change": virtool.utils.timestamp(),
            "invalidate_sessions": True
        })

    if "force_reset" in data:
        update.update({
            "force_reset": data["force_reset"],
            "invalidate_sessions": True
        })

    document = await db.users.find_one_and_update({"_id": user_id}, {
        "$set": update
    }, return_document=ReturnDocument.AFTER, projection=virtool.user.PROJECTION)

    return json_response(virtool.utils.base_processor(document))


@protected("manage_users")
@validation({
    "group_id": {"type": "string", "required": True}
})
async def add_group(req):
    """
    Enable membership in a group for the given user.

    """
    db, data = req.app["db"], req["data"]

    user_id = req.match_info["user_id"]

    if not await virtool.user.user_exists(db, user_id):
        return not_found("User not found")

    if data["group_id"] not in await db.groups.distinct("_id"):
        return not_found("Group not found")

    document = await db.users.find_one_and_update({"_id": user_id}, {
        "$addToSet": {
            "groups": data["group_id"]
        }
    }, return_document=ReturnDocument.AFTER, projection=["groups"])

    groups = await db.groups.find({"_id": {"$in": document["groups"]}}).to_list(None)

    new_permissions = virtool.user_groups.merge_group_permissions(groups)

    document = await db.users.find_one_and_update({"_id": user_id}, {
        "$set": {
            "permissions": new_permissions
        }
    }, return_document=ReturnDocument.AFTER, projection=virtool.user.PROJECTION)

    await virtool.user.update_sessions_and_keys(db, user_id, document["groups"], document["permissions"])

    return json_response(document["groups"])


@protected("manage_users")
async def remove_group(req):
    """
    Disable membership in a group for the given user.

    """
    db = req.app["db"]

    user_id = req.match_info["user_id"]
    group_id = req.match_info["group_id"]

    if not await virtool.user.user_exists(db, user_id):
        return not_found()

    if group_id == "administrator" and user_id == req["client"].user_id:
        return bad_request("Administrators cannot remove themselves from the administrator group")

    update = dict()

    if await db.users.count({"_id": user_id, "primary_group": group_id}):
        update["primary_group"] = ""

    document = await db.users.find_one_and_update({"_id": user_id}, {
        "$pull": {
            "groups": group_id
        }
    }, return_document=ReturnDocument.AFTER, projection=["groups", "primary_group"])

    groups = await db.groups.find({"_id": {
        "$in": document["groups"]
    }}).to_list(None)

    update["permissions"] = virtool.user_groups.merge_group_permissions(list(groups))

    document = await db.users.find_one_and_update({"_id": user_id}, {
        "$set": update
    }, return_document=ReturnDocument.AFTER, projection=virtool.user.PROJECTION)

    await virtool.user.update_sessions_and_keys(db, user_id, document["groups"], document["permissions"])

    return json_response(document["groups"])


@protected("manage_users")
async def remove(req):
    """
    Remove a user.

    """
    user_id = req.match_info["user_id"]

    if user_id == req["client"].user_id:
        return bad_request("Cannot remove own account")

    delete_result = await req.app["db"].users.delete_one({"_id": user_id})

    if delete_result.deleted_count == 0:
        return not_found()

    return no_content()
