from pymongo import ReturnDocument
from virtool.utils import timestamp
from virtool.handlers.utils import json_response, not_found
from virtool.permissions import PERMISSIONS
from virtool.groups import merge_group_permissions
from virtool.users import processor, invalidate_session, user_exists, hash_password


async def find(req):
    """
    Get a list of the existing ``user_ids`` in the database.
     
    """
    return json_response([processor(document) for document in await req.app["db"].users.find().to_list(None)])


async def get(req):
    """
    Get a near-complete user document. Sensitive data are removed:
    
    - password
    - salt
    - session ids
     
    """
    user_id = req.match_info["user_id"]

    document = req.app["db"].users.find_one(user_id)

    if not document:
        return not_found()

    document.pop("password")
    document.pop("salt")

    [session.pop("token") for session in document["sessions"]]

    return json_response(document)


async def create(req):
    """
    Add a new user to the user database.

    """
    data = await req.json()

    # Check if the username is already taken. Fail if it does.
    if await user_exists(req.app["db"], data["user_id"]):
        return json_response({"message": "User already exists"}, status=400)

    document = {
        "_id": data["_id"],
        # A list of group _ids the user is associated with.
        "groups": list(),
        "settings": ACCOUNT_SETTINGS,
        "sessions": [],
        "permissions": {permission: False for permission in PERMISSIONS},
        "password": hash_password(data["password"]),
        "primary_group": "",
        # Should the user be forced to reset their password on their next login?
        "force_reset": data["force_reset"],
        # A timestamp taken at the last password change.
        "last_password_change": timestamp(),
        # Should all of the user's sessions be invalidated so that they are forced to login next time they
        # download the client.
        "invalidate_sessions": False
    }

    await req.app["db"].users.insert(document)
    
    document["user_id"] = document.pop("_id")
    
    return json_response(document)


async def set_password(req):
    """
    Used by users with the *modify_options* permission to change other users passwords.

    """
    data = await req.json()

    user_id = req.match_info["user_id"]

    if not await user_exists(req.app["db"], user_id):
        return not_found()

    document = await req.app["db"].users.find_one_and_update({"_id": user_id}, {
        "$set": {
            "password": hash_password(data["password"]),
            "last_password_change": timestamp(),
            "invalidate_sessions": True
        }
    }, return_document=ReturnDocument.AFTER)

    return json_response(document)


async def set_force_reset(req):
    """
    Used by users with the *modify_options* permission to Set a users password. Can take a "reset" property, which
    when True will force the user to reset their password on next login. To be called by an connection with
    administrative privileges.

    """
    user_id = req.match_info["user_id"]

    data = await req.json()

    if not await user_exists(req.app["db"], user_id):
        return not_found("User does not exist")

    result = await req.app["db"].update({"_id": user_id}, {
        "$set": {
            "force_reset": data["force_reset"],
            "invalidate_sessions": True
        }
    })

    return json_response(result)


async def add_group(req):
    """
    Enable membership in a group for the given user.

    """
    user_id = req.match_info["user_id"]

    requesting_user = None

    data = await req.json()

    if not await user_exists(req.app["db"], user_id):
        not_found("User does not exist")

    if data["group_id"] == "administrator" and user_id == requesting_user:
        return json_response(
            {"message": "Administrators cannot remove themselves from the administrator group"},
            status=400
        )

    if data["group_id"] not in await req.app["db"].groups.distinct("_id"):
        return not_found("Group does not exist")

    member_group_ids = await req.app["db"].users.distinct("groups", {"_id": user_id})

    if data["group_id"] in member_group_ids:
        member_group_ids.remove(data["group_id"])
    else:
        member_group_ids.append(data["group_id"])

    groups = await req.app["db"].groups.find({"_id": {
        "$in": member_group_ids
    }}).to_list(None)

    new_permissions = merge_group_permissions(list(groups))

    document = await req.app["db"].users.find_one_and_update({"_id": user_id}, {
        "$set": {
            "permissions": new_permissions,
            "groups": member_group_ids
        }
    })

    return json_response(document)


async def remove_session(req):
    token = req.match_info["token"]

    removed = await invalidate_session(req.app["db"], token)

    if not removed:
        return not_found("Session does not exist")

    return json_response({"removed": removed})


async def remove(req):
    """
    Remove existing user with the id passed in the transaction.

    """
    data = await req.json()

    if data["_id"] == req["session"].user_id:
        return json_response({"message": "Cannot remove own account"}, status=400)

    result = await req.app["db"].users.remove({"_id": data["user_id"]})

    if result["n"] == 0:
        return not_found("User does not exist")

    return json_response({"removed": data["user_id"]})
