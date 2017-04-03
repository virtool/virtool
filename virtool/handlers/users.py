import virtool.utils

from pymongo import ReturnDocument
from cerberus import Validator

from virtool.handlers.utils import protected, bad_request, invalid_input, unpack_json_request, json_response, not_found
from virtool.permissions import PERMISSIONS
from virtool.groups import merge_group_permissions
from virtool.users import projection, processor, invalidate_session, user_exists, hash_password


@protected("manage_users")
async def find(req):
    """
    Get a list of the existing ``user_ids`` in the database.
     
    """
    data = [processor(document) for document in await req.app["db"].users.find({}, projection).to_list(None)]
    return json_response(data)


@protected("manage_users")
async def get(req):
    """
    Get a near-complete user document. Password data are removed.
     
    """
    document = await req.app["db"].users.find_one(req.match_info["user_id"], projection)

    if not document:
        return not_found()

    return json_response(processor(document))


@protected("manage_users")
async def create(req):
    """
    Add a new user to the user database.

    """
    db, data = await unpack_json_request(req)

    v = Validator({
        "user_id": {"type": "string", "required": True},
        "password": {"type": "string", "required": True},
        "force_reset": {"type": "boolean"}
    })

    if not v(data):
        return invalid_input(v.errors)

    # Check if the username is already taken. Fail if it does.
    if await user_exists(db, data["user_id"]):
        return bad_request("User already exists")

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
        "sessions": [],
        "permissions": {permission: False for permission in PERMISSIONS},
        "password": hash_password(data["password"]),
        "primary_group": "",
        # Should the user be forced to reset their password on their next login?
        "force_reset": data.get("force_reset", True),
        # A timestamp taken at the last password change.
        "last_password_change": virtool.utils.timestamp(),
        # Should all of the user's sessions be invalidated so that they are forced to login next time they
        # download the client.
        "invalidate_sessions": False
    }

    await db.users.insert(document)
    
    return json_response(processor({key: document[key] for key in projection}))


@protected("manage_users")
async def set_password(req):
    """
    Used by users with the *modify_options* permission to change other users passwords.

    """
    data = await req.json()

    v = Validator({
        "password": {"type": "string", "required": True}
    })

    if not v(data):
        return invalid_input(v.errors)

    user_id = req.match_info["user_id"]

    if not await user_exists(req.app["db"], user_id):
        return not_found()

    document = await req.app["db"].users.find_one_and_update({"_id": user_id}, {
        "$set": {
            "password": hash_password(data["password"]),
            "last_password_change": virtool.utils.timestamp(),
            "invalidate_sessions": True
        }
    }, return_document=ReturnDocument.AFTER, projection=["force_reset", "last_password_change"])

    document["user_id"] = document.pop("_id")

    return json_response(document)


@protected("manage_users")
async def set_force_reset(req):
    """
    Used by users with the *modify_options* permission to Set a users password. Can take a "reset" property, which
    when True will force the user to reset their password on next login. To be called by an connection with
    administrative privileges.

    """
    user_id = req.match_info["user_id"]

    data = await req.json()

    print(data)

    v = Validator({
        "force_reset": {"type": "boolean", "required": True}
    })

    if not v(data):
        return invalid_input(v.errors)

    if not await user_exists(req.app["db"], user_id):
        return not_found("User does not exist")

    document = await req.app["db"].users.find_one_and_update({"_id": user_id}, {
        "$set": {
            "force_reset": data["force_reset"],
            "invalidate_sessions": True
        }
    }, return_document=ReturnDocument.AFTER, projection=["force_reset"])

    document["user_id"] = document.pop("_id")

    return json_response(document)


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
