from aiohttp import web
from pymongo import ReturnDocument
from virtool.utils import timestamp
from virtool.data.users import salt_hash, validate_login, invalidate_session, ACCOUNT_SETTINGS

VALID_SETTING_KEYS = ACCOUNT_SETTINGS.keys()


async def get_settings(req):
    """
    Get account settings
    
    """
    pass


async def update_settings(req):
    """
    Update account settings.

    """
    user_id = None

    data = await req.json()

    if not all(key in VALID_SETTING_KEYS for key in data.keys()):
        return web.json_response({"message": "Invalid setting field(s)."}, status=400)

    settings = (await req["db"].users.find_one({"_id": user_id}))["settings"]

    settings.update(data)

    document = await req["db"].users.find_one_and_update({"_id": user_id}, {
        "$set": {
            "settings": settings
        }
    }, return_document=ReturnDocument.AFTER)

    document["user_id"] = document.pop("_id")

    return web.json_response(document)


async def change_password(req):
    """
    Allows a user change their own password.

    """
    data = await req.json()

    requesting_user = None

    # Will evaluate true if the passed username and password are correct.
    if not await validate_login(req["db"], requesting_user["user_id"], data["old_password"]):
        return web.json_response({"message": "Invalid credentials"}, status=400)

    # Salt and hash the new password
    salt, password = salt_hash(data["new_password"])

    # Update the user document. Remove all sessions so those clients will have to authenticate with the new
    # password.
    response = await req["db"].users.update({"_id": requesting_user}, {
        "$set": {
            "password": password,
            "sessions": [],
            "invalidate_sessions": False,
            "salt": salt,
            "last_password_change": timestamp(),
            "force_reset": False
        }
    })

    return True, response


async def logout(req):
    requesting_token = None

    await invalidate_session(req["db"], requesting_token, logout=True)

    return web.json_response({"logout": True})
