from pymongo import ReturnDocument

import virtool.utils
import virtool.user
import virtool.user_permissions
import virtool.validators

from virtool.handlers.utils import json_response, no_content, bad_request, protected, validation, unpack_request, \
    not_found

SETTINGS_SCHEMA = {
    "show_ids": {
        "type": "boolean",
        "required": False
    },
    "skip_quick_analyze_dialog": {
        "type": "boolean",
        "required": False
    },
    "quick_analyze_algorithm": {
        "type": "string",
        "required": False
    }
}


PASSWORD_SCHEMA = {
    "old_password": {"type": "string", "required": True},
    "new_password": {"type": "string", "required": True}
}


@protected()
async def get(req):
    """
    Get complete user document

    """
    user_id = req["client"].user_id

    document = await req.app["db"].users.find_one(user_id, virtool.user.ACCOUNT_PROJECTION)

    return json_response(virtool.user.account_processor(document))


@protected()
async def get_settings(req):
    """
    Get account settings

    """
    user_id = req["client"].user_id

    document = await req.app["db"].users.find_one(user_id)

    return json_response(document["settings"])


@protected()
@validation(SETTINGS_SCHEMA)
async def update_settings(req):
    """
    Update account settings.

    """
    db, data = req.app["db"], req["data"]

    user_id = req["client"].user_id

    document = await db.users.find_one(user_id, ["settings"])

    settings = document["settings"]

    settings.update(data)

    document = await db.users.find_one_and_update({"_id": user_id}, {
        "$set": {
            "settings": settings
        }
    }, return_document=ReturnDocument.AFTER, projection=["settings"])

    return json_response(document["settings"])


@protected()
@validation(PASSWORD_SCHEMA)
async def change_password(req):
    """
    Allows a user change their own password.

    """
    db, data = req.app["db"], req["data"]

    user_id = req["client"].user_id

    data = await req.json()

    if len(data["new_password"]) < 8:
        return bad_request("Password is to short. Must be at least 8 characters.")

    # Will evaluate true if the passed username and password are correct.
    if not await virtool.user.validate_credentials(db, user_id, data["old_password"]):
        return bad_request("Invalid old password")

    # Salt and hash the new password
    hashed = virtool.user.hash_password(data["new_password"])

    last_password_change = virtool.utils.timestamp()

    # Update the user document. Remove all sessions so those clients will have to authenticate with the new
    # password.
    await db.users.update_one({"_id": user_id}, {
        "$set": {
            "password": hashed,
            "invalidate_sessions": False,
            "last_password_change": last_password_change,
            "force_reset": False
        }
    })

    return json_response({"last_password_change": last_password_change})


@protected()
@validation({
    "name": {"type": "string", "required": True, "minlength": 1},
    "permissions": {"type": "dict", "validator": virtool.validators.is_permission_dict}
})
async def create_api_key(req):
    db, data = await unpack_request(req)

    name = data["name"]
    permissions = data.get("permissions", None) or {key: False for key in virtool.user_permissions.PERMISSIONS}

    user_id = req["client"].user_id

    document = await db.users.find_one({"_id": user_id}, ["api_keys"])

    existing_ids = [key["id"] for key in document["api_keys"]]

    key_id = name.lower().replace(" ", "_")

    suffix = 0

    while True:
        candidate = "{}_{}".format(key_id, suffix)

        if candidate not in existing_ids:
            key_id = candidate
            break

        suffix += 1

    raw = virtool.user.get_api_key()

    document = await db.users.find_one_and_update({"_id": user_id}, {
        "$push": {
            "api_keys": {
                "id": key_id,
                "name": name,
                "permissions": permissions,
                "key": virtool.user.hash_api_key(raw),
                "created_at": virtool.utils.timestamp()
            }
        }
    }, return_document=ReturnDocument.AFTER, projection=virtool.user.ACCOUNT_PROJECTION)

    document = virtool.user.account_processor(document)

    await req.app["dispatcher"].dispatch("users", "update", document)

    for key in document["api_keys"]:
        if key["id"] == key_id:
            key["raw"] = raw
            return json_response(key, status=201)


@protected()
@validation({
    "permissions": {"type": "dict", "validator": virtool.validators.is_permission_dict}
})
async def update_api_key(req):
    db, data = await unpack_request(req)

    key_id = req.match_info.get("key_id")

    user_id = req["client"].user_id

    query = {"_id": user_id, "api_keys.id": key_id}

    document = await db.users.find_one(query, ["api_keys"])

    if not document:
        return not_found()

    permissions = None

    for api_key in document["api_keys"]:
        if api_key["id"] == key_id:
            permissions = api_key["permissions"]
            permissions.update(data["permissions"])
            break

    document = await db.users.find_one_and_update(query, {
        "$set": {
            "api_keys.$.permissions": permissions
        }
    }, return_document=ReturnDocument.AFTER, projection=virtool.user.ACCOUNT_PROJECTION)

    document = virtool.user.account_processor(document)

    await req.app["dispatcher"].dispatch("users", "update", document)

    for key in document["api_keys"]:
        if key["id"] == key_id:
            return json_response(key, status=200)


@protected()
async def remove_api_key(req):
    db = req.app["db"]

    user_id = req["client"].user_id
    key_id = req.match_info.get("key_id")

    if not await db.users.count({"_id": user_id, "api_keys.id": key_id}):
        return not_found()

    document = await db.users.find_one_and_update({"_id": user_id}, {
        "$pull": {
            "api_keys": {
                "id": key_id
            }
        }
    }, return_document=ReturnDocument.AFTER, projection=virtool.user.ACCOUNT_PROJECTION)

    await req.app["dispatcher"].dispatch("users", "update", virtool.user.account_processor(document))

    return no_content()

@protected()
async def logout(req):
    """
    Invalidates the requesting session, effectively logging out the user.

    """
    db = req.app["db"]

    session_id = req["client"].id

    await db.sessions.delete_one({"_id": session_id})

    return no_content()
