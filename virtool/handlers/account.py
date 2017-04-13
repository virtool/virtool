from pymongo import ReturnDocument
from virtool.utils import timestamp
from virtool.handlers.utils import json_response, bad_request, requires_login, protected, validation
from virtool.users import hash_password, validate_credentials


SETTINGS_SCHEMA = {
    "show_ids": {
        "type": "boolean",
        "required": False
    },
    "show_versions": {
        "type": "boolean",
        "required": False
    },
    "quick_analyze_algorithm": {
        "type": "boolean",
        "required": False
    },
    "skip_quick_analyze_dialog": {
        "type": "string",
        "required": False
    }
}


PASSWORD_SCHEMA = {
    "old_password": {"type": "string", "required": True},
    "new_password": {"type": "string", "required": True}
}


@protected()
async def get_settings(req):
    """
    Get account settings
    
    """
    user_id = req["session"].user_id

    if not user_id:
        return requires_login()

    document = await req.app["db"].users.find_one(user_id)

    return json_response(document["settings"])


@protected()
@validation(SETTINGS_SCHEMA)
async def update_settings(req):
    """
    Update account settings.

    """
    db, data = req.app["db"], req["data"]

    user_id = req["session"].user_id

    settings = (await db.users.find_one({"_id": user_id}))["settings"]

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

    user_id = req["session"].user_id

    data = await req.json()

    # Will evaluate true if the passed username and password are correct.
    if not await validate_credentials(db, user_id, data["old_password"]):
        return bad_request("Invalid credentials")

    # Salt and hash the new password
    hashed = hash_password(data["new_password"])

    last_password_change = timestamp()

    # Update the user document. Remove all sessions so those clients will have to authenticate with the new
    # password.
    await db.users.update({"_id": user_id}, {
        "$set": {
            "password": hashed,
            "invalidate_sessions": False,
            "last_password_change": last_password_change,
            "force_reset": False
        }
    })

    return json_response({"timestamp": last_password_change})
