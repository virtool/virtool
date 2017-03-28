from aiohttp import web
from pymongo import ReturnDocument
from virtool.utils import timestamp
from virtool.users import salt_hash, validate_login, invalidate_session, ACCOUNT_SETTINGS

VALID_SETTING_KEYS = ACCOUNT_SETTINGS.keys()


async def get_settings(req):
    """
    Get account settings
    
    """
    user_id = req["session"]["user_id"]

    document = await req.app["db"].users.find_one({"_id": user_id})

    return web.json_response(document["settings"])


async def update_settings(req):
    """
    Update account settings.

    """
    user_id = req["session"]["user_id"]

    data = await req.json()

    if not all(key in VALID_SETTING_KEYS for key in data.keys()):
        return web.json_response({"message": "Invalid setting field(s)."}, status=400)

    settings = (await req.app["db"].users.find_one({"_id": user_id}))["settings"]

    settings.update(data)

    document = await req.app["db"].users.find_one_and_update({"_id": user_id}, {
        "$set": {
            "settings": settings
        }
    }, return_document=ReturnDocument.AFTER)

    return web.json_response(document["settings"])


async def change_password(req):
    """
    Allows a user change their own password.

    """
    data = await req.json()

    user_id = req.match_info["user_id"]

    # Will evaluate true if the passed username and password are correct.
    if not await validate_login(req.app["db"], user_id, data["old_password"]):
        return web.json_response({"message": "Invalid credentials"}, status=400)

    # Salt and hash the new password
    salt, password = salt_hash(data["new_password"])

    # Update the user document. Remove all sessions so those clients will have to authenticate with the new
    # password.
    response = await req.app["db"].users.update({"_id": user_id}, {
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

    await invalidate_session(req.app["db"], requesting_token, logout=True)

    return web.json_response({"logout": True})
