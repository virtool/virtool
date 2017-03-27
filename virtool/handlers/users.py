from aiohttp import web
from pymongo import ReturnDocument
from virtool.utils import timestamp
from virtool.permissions import PERMISSIONS
from virtool.data.groups import merge_group_permissions
from virtool.data.users import invalidate_session, user_exists, salt_hash, ACCOUNT_SETTINGS


async def list_users(req):
    """
    Get a list of the existing ``user_ids`` in the database.
     
    """
    return web.json_response({"users": req["db"].users.distinct("_id")})


async def get_user(req):
    """
    Get a near-complete user document. Sensitive data are removed:
    
    - password
    - salt
    - session ids
     
    """
    user_id = req.match_info["user_id"]

    document = req["db"].users.find_one(user_id)

    if not document:
        return web.json_response({"Not found"}, status=404)

    document.pop("password")
    document.pop("salt")

    [session.pop("token") for session in document["sessions"]]

    return web.json_response(document)


async def create_user(req):
    """
    Add a new user to the user database.

    """
    data = await req.json()

    # Check if the username is already taken. Fail if it does.
    if await user_exists(req["db"], data["user_id"]):
        return web.json_response({"message": "User already exists"}, status=400)

    salt, password = salt_hash(data["password"])

    document = {
        "_id": data["_id"],
        # A list of group _ids the user is associated with.
        "groups": list(),
        "settings": ACCOUNT_SETTINGS,
        "sessions": [],
        "salt": salt,
        "permissions": {permission: False for permission in PERMISSIONS},
        "password": password,
        "primary_group": "",
        # Should the user be forced to reset their password on their next login?
        "force_reset": data["force_reset"],
        # A timestamp taken at the last password change.
        "last_password_change": timestamp(),
        # Should all of the user's sessions be invalidated so that they are forced to login next time they
        # download the client.
        "invalidate_sessions": False
    }

    await req["db"].users.insert(document)
    
    document["user_id"] = document.pop("_id")
    
    return web.json_response(document)


async def set_password(req):
    """
    Used by users with the *modify_options* permission to change other users passwords.

    """
    data = await req.json()

    user_id = req.match_info["user_id"]

    if not await user_exists(req["db"], user_id):
        return web.json_response({"Not found"}, status=404)

    salt, password = salt_hash(data["new_password"])

    document = await req["db"].users.find_one_and_update({"_id": user_id}, {
        "$set": {
            "password": password,
            "salt": salt,
            "last_password_change": timestamp(),
            "invalidate_sessions": True
        }
    }, return_document=ReturnDocument.AFTER)

    return web.json_response(document)


async def set_force_reset(req):
    """
    Used by users with the *modify_options* permission to Set a users password. Can take a "reset" property, which
    when True will force the user to reset their password on next login. To be called by an connection with
    administrative privileges.

    """
    user_id = req.match_info["user_id"]

    data = await req.json()

    if not await user_exists(req["db"], user_id):
        return web.json_response({"message": "User does not exist"}, status=404)

    result = await req["db"].update({"_id": user_id}, {
        "$set": {
            "force_reset": data["force_reset"],
            "invalidate_sessions": True
        }
    })

    return web.json_response(result)


async def add_group(req):
    """
    Enable membership in a group for the given user.

    """
    user_id = req.match_info["user_id"]

    requesting_user = None

    data = await req.json()

    if not await user_exists(req["db"], user_id):
        web.json_response({"message": "User does not exist"}, status=404)

    if data["group_id"] == "administrator" and user_id == requesting_user:
        return web.json_response(
            {"message": "Administrators cannot remove themselves from the administrator group"},
            status=400
        )

    if data["group_id"] not in await req["db"].groups.distinct("_id"):
        return web.json_response({"message": "Group does not exist"}, status=404)

    member_group_ids = await req["db"].users.distinct("groups", {"_id": user_id})

    if data["group_id"] in member_group_ids:
        member_group_ids.remove(data["group_id"])
    else:
        member_group_ids.append(data["group_id"])

    groups = await req["db"].groups.find({"_id": {
        "$in": member_group_ids
    }}).to_list(None)

    new_permissions = merge_group_permissions(list(groups))

    document = await req["db"].users.find_one_and_update({"_id": user_id}, {
        "$set": {
            "permissions": new_permissions,
            "groups": member_group_ids
        }
    })

    return web.json_response(document)


async def remove_session(req):
    token = req.match_info["token"]

    removed = await invalidate_session(req["db"], token)

    if not removed:
        return web.json_response({"message": "Session does not exist"}, status=404)

    return web.json_response({"removed": removed})


async def remove_user(req):
    """
    Remove existing user with the id passed in the transaction.

    """
    data = await req.json()

    requesting_user = None

    # Only one user specified by one user id can be removed per call.
    if not isinstance(data["user_id"], str):
        return web.json_response({"message": "Invalid user_id"}, status=400)

    if data["_id"] == requesting_user:
        # Otherwise send an error message to the client and log a warning.
        return web.json_response({"message": "Cannot remove own account"}, status=400)

    result = await req["db"].users.remove({"_id": data["user_id"]})

    if result["n"] == 0:
        return web.json_response({"message": "User does not exist"})

    return web.json_response({"removed": data["user_id"]})
