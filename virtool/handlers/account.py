from cerberus import Validator
from pymongo import ReturnDocument

import virtool.utils
import virtool.user
import virtool.user_permissions
import virtool.validators

from virtool.handlers.utils import bad_request, invalid_input, json_response, no_content, not_found, protected,\
    unpack_request, validation


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


@protected()
async def get(req):
    """
    Get complete user document

    """
    user_id = req["client"].user_id

    document = await req.app["db"].users.find_one(user_id, virtool.user.ACCOUNT_PROJECTION)

    return json_response(virtool.utils.base_processor(document))


@protected()
@validation({
    "email": {"type": "string", "regex": "^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$"}
})
async def edit(req):
    """
    Edit the user account.

    """
    db = req.app["db"]
    data = req["data"]

    user_id = req["client"].user_id

    document = await db.users.find_one_and_update({"_id": user_id}, {
        "$set": {
            "email": data["email"]
        }
    }, return_document=ReturnDocument.AFTER, projection=virtool.user.ACCOUNT_PROJECTION)

    return json_response(virtool.utils.base_processor(document))


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
async def change_password(req):
    """
    Allows a user change their own password.

    """
    db = req.app["db"]

    user_id = req["client"].user_id

    data = await req.json()

    minlength = req.app["settings"]["minimum_password_length"]

    v = Validator({
        "old_password": {"type": "string", "minlength": minlength, "required": True},
        "new_password": {"type": "string", "minlength": minlength, "required": True}
    })

    if not v(data):
        return invalid_input(v.errors)

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
async def get_api_keys(req):
    db = req.app["db"]

    user_id = req["client"].user_id

    api_keys = await db.keys.find({"user.id": user_id}, {"_id": False}).to_list(None)

    for api_key in api_keys:
        del api_key["user"]

    return json_response(api_keys, status=200)


@protected()
@validation({
    "name": {"type": "string", "required": True, "minlength": 1},
    "permissions": {"type": "dict", "validator": virtool.validators.is_permission_dict}
})
async def create_api_key(req):
    db, data = await unpack_request(req)

    name = data["name"]

    permissions = {key: False for key in virtool.user_permissions.PERMISSIONS}

    permissions.update(data.get("permissions", {}))

    user_id = req["client"].user_id

    existing_alt_ids = await db.keys.distinct("id")

    suffix = 0

    while True:
        candidate = "{}_{}".format(name.lower(), suffix)

        if candidate not in existing_alt_ids:
            alt_id = candidate
            break

        suffix += 1

    raw = virtool.user.get_api_key()

    document = {
        "_id": virtool.user.hash_api_key(raw),
        "id": alt_id,
        "name": name,
        "groups": req["client"].groups,
        "permissions": permissions,
        "created_at": virtool.utils.timestamp(),
        "user": {
            "id": user_id
        }
    }

    await db.keys.insert_one(document)

    del document["_id"]
    del document["user"]

    document["key"] = raw

    return json_response(document, status=201)


@protected()
@validation({
    "permissions": {"type": "dict", "validator": virtool.validators.is_permission_dict}
})
async def update_api_key(req):
    db, data = await unpack_request(req)

    key_id = req.match_info.get("key_id")

    user_id = req["client"].user_id

    document = await db.keys.find_one({"id": key_id, "user.id": user_id}, ["permissions"])

    if document is None:
        return not_found()

    permissions = document["permissions"]

    permissions.update(data["permissions"])

    document = await db.keys.find_one_and_update({"_id": document["_id"]}, {
        "$set": {
            "permissions": permissions
        }
    }, return_document=ReturnDocument.AFTER, projection={"_id": False, "user": False})

    return json_response(document)


@protected()
async def remove_api_key(req):
    db = req.app["db"]

    user_id = req["client"].user_id
    key_id = req.match_info.get("key_id")

    delete_result = await db.keys.delete_one({"id": key_id, "user.id": user_id})

    if delete_result.deleted_count == 0:
        return not_found()

    return no_content()


@protected()
async def remove_all_api_keys(req):
    db = req.app["db"]

    await db.keys.delete_many({"user.id": req["client"].user_id})

    return no_content()


@protected()
async def logout(req):
    """
    Invalidates the requesting session, effectively logging out the user.

    """
    db = req.app["db"]

    session_id = req["client"].session_id

    if session_id:
        await db.sessions.delete_one({"_id": session_id})

    return no_content()
