import hashlib
from pymongo import ReturnDocument
from cerberus import Validator

import virtool.user
import virtool.utils
import virtool.user_groups
from virtool.user_permissions import PERMISSIONS
from virtool.handlers.utils import protected, no_content, bad_request, invalid_input, unpack_request, json_response,\
    not_found


@protected("manage_users")
async def find(req):
    """
    Get a list of all user documents in the database.

    """
    users = await req.app["db"].users.find({}, virtool.user.PROJECTION).to_list(length=None)

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
async def create(req):
    """
    Add a new user to the user database.

    """
    db, data = await unpack_request(req)

    v = Validator({
        "user_id": {"type": "string", "required": True},
        "password": {"type": "string", "required": True},
        "force_reset": {"type": "boolean"}
    })

    if not v(data):
        return invalid_input(v.errors)

    # Check if the username is already taken. Fail if it does.
    if await virtool.user.user_exists(db, data["user_id"]):
        return json_response({
            "id": "conflict",
            "message": "User already exists"
        }, status=409)

    document = {
        "_id": data["user_id"],
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

    return json_response(virtool.utils.base_processor({key: document[key] for key in virtool.user.PROJECTION}))


@protected("manage_users")
async def set_password(req):
    """
    Used by users with the *modify_options* permission to change other users passwords.

    """
    db, data = await unpack_request(req)

    v = Validator({
        "password": {"type": "string", "required": True}
    })

    if not v(data):
        return invalid_input(v.errors)

    user_id = req.match_info["user_id"]

    if not await virtool.user.user_exists(db, user_id):
        return not_found()

    document = await db.users.find_one_and_update({"_id": user_id}, {
        "$set": {
            "password": virtool.user.hash_password(data["password"]),
            "last_password_change": virtool.utils.timestamp(),
            "invalidate_sessions": True
        }
    }, return_document=ReturnDocument.AFTER, projection=virtool.user.PROJECTION)

    return json_response(virtool.utils.base_processor(document))


@protected("manage_users")
async def set_force_reset(req):
    """
    Set the ``force_reset`` field on user document.

    """
    db, data = await unpack_request(req)

    user_id = req.match_info["user_id"]

    v = Validator({
        "force_reset": {"type": "boolean", "required": True}
    })

    if not v(data):
        return invalid_input(v.errors)

    if not await virtool.user.user_exists(db, user_id):
        return not_found()

    document = await db.users.find_one_and_update({"_id": user_id}, {
        "$set": {
            "force_reset": data["force_reset"],
            "invalidate_sessions": True
        }
    }, return_document=ReturnDocument.AFTER, projection=virtool.user.PROJECTION)

    return json_response(virtool.utils.base_processor(document))


@protected("manage_users")
async def set_primary_group(req):
    """
    Set a user's primary group.

    """
    db, data = await unpack_request(req)

    user_id = req.match_info["user_id"]

    v = Validator({
        "primary_group": {"type": "string", "required": True}
    })

    if not v(data):
        return invalid_input(v.errors)

    if not await virtool.user.user_exists(db, user_id):
        return not_found()

    if data["primary_group"] != "none":
        if not await db.users.count({"_id": user_id, "groups": data["primary_group"]}):
            return bad_request("User is not member of group {}".format(data["primary_group"]))

    document = await db.users.find_one_and_update({"_id": user_id}, {
        "$set": {
            "primary_group": data["primary_group"]
        }
    }, return_document=ReturnDocument.AFTER, projection=virtool.user.PROJECTION)

    return json_response(virtool.utils.base_processor(document))


@protected("manage_users")
async def add_group(req):
    """
    Enable membership in a group for the given user.

    """
    db, data = await unpack_request(req)

    user_id = req.match_info["user_id"]

    v = Validator({
        "group_id": {"type": "string", "required": True}
    })

    if not v(data):
        return invalid_input(v.errors)

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

    return json_response(virtool.utils.base_processor(document))


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

    document = await db.users.find_one_and_update({"_id": user_id}, {
        "$pull": {
            "groups": group_id
        }
    }, return_document=ReturnDocument.AFTER, projection=["groups"])

    groups = await db.groups.find({"_id": {
        "$in": document["groups"]
    }}).to_list(None)

    document = await db.users.find_one_and_update({"_id": user_id}, {
        "$set": {
            "permissions": virtool.user_groups.merge_group_permissions(list(groups))
        }
    }, return_document=ReturnDocument.AFTER, projection=virtool.user.PROJECTION)

    return json_response(virtool.utils.base_processor(document))


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
