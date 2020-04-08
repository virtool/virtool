import aiohttp.web

import virtool.analyses.utils
import virtool.http.utils
import virtool.users.checks
import virtool.account.db
import virtool.users.sessions
import virtool.users.db
import virtool.db.utils
import virtool.http.auth
import virtool.http.routes
import virtool.users.utils
import virtool.utils
import virtool.validators
from virtool.api import bad_request, json_response, no_content, not_found

#: A MongoDB projection to use when returning API key documents to clients. The key should never be sent to client after
#: its creation.
API_KEY_PROJECTION = {
    "_id": False,
    "user": False
}

#: A :class:`aiohttp.web.RouteTableDef` for account API routes.
routes = virtool.http.routes.Routes()


@routes.get("/api/account")
async def get(req):
    """
    Get complete user document.

    """
    document = await virtool.account.db.get_document(req.app["db"], req["client"].user_id)
    return json_response(virtool.utils.base_processor(document))


@routes.patch("/api/account", schema={
    "email": {
        "type": "string",
        "coerce": virtool.validators.strip,
        "regex": r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$"
    },
    "old_password": {
        "type": "string"
    },
    "password": {
        "type": "string",
        "dependencies": "old_password"
    }

})
async def edit(req):
    """
    Edit the user account.

    """
    db = req.app["db"]
    data = req["data"]
    user_id = req["client"].user_id

    password = data.get("password")
    old_password = data.get("old_password")

    update = dict()

    if password is not None:
        error = await virtool.users.checks.check_password_length(req)

        if error:
            return bad_request(error)

        if not await virtool.users.db.validate_credentials(db, user_id, old_password or ""):
            return bad_request("Invalid credentials")

        update = virtool.account.db.compose_password_update(password)

    if "email" in data:
        update["email"] = data["email"]

    if update:
        document = await db.users.find_one_and_update({"_id": user_id}, {
            "$set": update
        }, projection=virtool.account.db.PROJECTION)
    else:
        document = await virtool.account.db.get_document(db, user_id)

    return json_response(virtool.utils.base_processor(document))


@routes.get("/api/account/settings")
async def get_settings(req):
    """
    Get account settings

    """
    account_settings = await virtool.db.utils.get_one_field(
        req.app["db"].users,
        "settings",
        req["client"].user_id
    )

    return json_response(account_settings)


@routes.patch("/api/account/settings", schema={
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
        "allowed": virtool.analyses.utils.ALGORITHM_NAMES,
        "required": False
    }
})
async def update_settings(req):
    """
    Update account settings.

    """
    db = req.app["db"]
    data = req["data"]

    user_id = req["client"].user_id

    settings_from_db = await virtool.db.utils.get_one_field(db.users, "settings", user_id)

    settings = {
        **settings_from_db,
        **data
    }

    await db.users.update_one({"_id": user_id}, {
        "$set": settings
    })

    return json_response(settings)


@routes.get("/api/account/keys")
async def get_api_keys(req):
    db = req.app["db"]

    user_id = req["client"].user_id

    cursor = db.keys.find({"user.id": user_id}, API_KEY_PROJECTION)

    return json_response([d async for d in cursor], status=200)


@routes.get("/api/account/keys/{key_id}")
async def get_api_key(req):
    db = req.app["db"]
    user_id = req["client"].user_id
    key_id = req.match_info["key_id"]

    document = await db.keys.find_one({"id": key_id, "user.id": user_id}, API_KEY_PROJECTION)

    if document is None:
        return not_found()

    return json_response(document, status=200)


@routes.post("/api/account/keys", schema={
    "name": {
        "type": "string",
        "coerce": virtool.validators.strip,
        "empty": False,
        "required": True
    },
    "permissions": {
        "type": "dict",
        "default": {},
        "validator": virtool.validators.is_permission_dict
    }
})
async def create_api_key(req):
    """
    Create a new API key. The new key value is returned in the response. This is the only response from the server that
    will ever include the key.

    """
    db = req.app["db"]
    data = req["data"]

    user_id = req["client"].user_id

    document = await virtool.account.db.create_api_key(
        db,
        data["name"],
        data["permissions"],
        user_id
    )

    headers = {
        "Location": f"/api/account/keys/{document['id']}"
    }

    return json_response(document, headers=headers, status=201)


@routes.patch("/api/account/keys/{key_id}", schema={
    "permissions": {
        "type": "dict",
        "validator": virtool.validators.is_permission_dict,
        "required": True
    }
})
async def update_api_key(req):
    """
    Change the permissions for an existing API key.

    """
    db = req.app["db"]
    data = req["data"]

    key_id = req.match_info.get("key_id")

    if not await db.keys.count_documents({"id": key_id}):
        return not_found()

    user_id = req["client"].user_id

    user = await db.users.find_one(user_id, ["administrator", "permissions"])

    # The permissions currently assigned to the API key.
    permissions = await virtool.db.utils.get_one_field(
        db.keys,
        "permissions",
        {"id": key_id, "user.id": user_id}
    )

    permissions.update(data["permissions"])

    if not user["administrator"]:
        permissions = virtool.users.utils.limit_permissions(permissions, user["permissions"])

    document = await db.keys.find_one_and_update({"id": key_id}, {
        "$set": {
            "permissions": permissions
        }
    }, projection=API_KEY_PROJECTION)

    return json_response(document)


@routes.delete("/api/account/keys/{key_id}")
async def remove_api_key(req):
    db = req.app["db"]
    user_id = req["client"].user_id
    key_id = req.match_info["key_id"]

    delete_result = await db.keys.delete_one({
        "id": key_id,
        "user.id": user_id
    })

    if delete_result.deleted_count == 0:
        return not_found()

    return no_content()


@routes.delete("/api/account/keys")
async def remove_all_api_keys(req):
    """
    Remove all API keys for the session account.

    """
    await req.app["db"].keys.delete_many({"user.id": req["client"].user_id})
    return no_content()


@routes.post("/api/account/login", public=True, schema={
    "username": {
        "type": "string",
        "empty": False,
        "required": True
    },
    "password": {
        "type": "string",
        "empty": False,
        "required": True
    },
    "remember": {
        "type": "boolean",
        "default": False
    }
})
async def login(req):
    """
    Create a new session for the user with `username`.

    """
    db = req.app["db"]
    data = req["data"]

    user_id = data["username"]
    password = data["password"]

    # When this value is set, the session will last for 1 month instead of the 1 hour default.
    remember = data["remember"]

    # Re-render the login page with an error message if the username and/or password are invalid.
    if not await virtool.users.db.validate_credentials(db, user_id, password):
        return bad_request("Invalid username or password")

    session_id = req.cookies.get("session_id")

    # If the user's password needs to be reset, redirect to the reset page without authorizing the session. A one-time
    # reset code is generated and added to the query string.
    if await virtool.db.utils.get_one_field(db.users, "force_reset", user_id):
        return json_response({
            "reset": True,
            "reset_code": await virtool.users.sessions.create_reset_code(db, session_id, user_id, remember)
        }, status=200)

    session, token = await virtool.users.sessions.replace_session(
        db,
        session_id,
        virtool.http.auth.get_ip(req),
        user_id,
        remember
    )

    resp = json_response({"reset": False}, status=201)

    virtool.http.utils.set_session_id_cookie(resp, session["_id"])
    virtool.http.utils.set_session_token_cookie(resp, token)

    return resp


@routes.get("/api/account/logout", public=True)
async def logout(req):
    """
    Invalidates the requesting session, effectively logging out the user.

    """
    db = req.app["db"]
    old_session_id = req.cookies.get("session_id")

    session, _ = await virtool.users.sessions.replace_session(
        db,
        old_session_id,
        virtool.http.auth.get_ip(req)
    )

    resp = aiohttp.web.Response(status=200)

    virtool.http.utils.set_session_id_cookie(resp, session["_id"])
    resp.del_cookie("session_token")

    return resp


@routes.post("/api/account/reset", public=True, schema={
    "password": {
        "type": "string",
        "required": True
    },
    "reset_code": {
        "type": "string",
        "required": True
    }
})
async def reset(req):
    """
    Handles `POST` requests for resetting the password for a session user.

    :param req: the request to handle
    :return: a response

    """
    db = req.app["db"]
    session_id = req["client"].session_id

    password = req["data"]["password"]
    reset_code = req["data"]["reset_code"]

    session = await db.sessions.find_one(session_id)

    error = await virtool.users.checks.check_password_length(req)

    if not session.get("reset_code") or not session.get("reset_user_id") or reset_code != session.get("reset_code"):
        error = "Invalid reset code"

    user_id = session["reset_user_id"]

    if error:
        return json_response({
            "error": error,
            "reset_code": await virtool.users.sessions.create_reset_code(db, session_id, user_id=user_id)
        }, status=400)

    # Update the user password and disable the `force_reset`.
    await virtool.users.db.edit(db, user_id, force_reset=False, password=password)

    new_session, token = await virtool.users.sessions.replace_session(
        db,
        session_id,
        virtool.http.auth.get_ip(req),
        user_id,
        remember=session.get("reset_remember", False)
    )

    req["client"].authorize(new_session, is_api=False)

    resp = json_response({
        "login": False,
        "reset": False
    }, status=200)

    virtool.http.utils.set_session_id_cookie(resp, new_session["_id"])
    virtool.http.utils.set_session_token_cookie(resp, token)

    # Authenticate and return a redirect response to the `return_to` path. This is identical to the process used for
    # successful login requests.
    return resp
