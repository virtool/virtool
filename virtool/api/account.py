import virtool.analyses
import virtool.db.account
import virtool.db.sessions
import virtool.db.users
import virtool.db.utils
import virtool.http.auth
import virtool.http.routes
import virtool.users
import virtool.utils
import virtool.validators
from virtool.api.utils import bad_request, json_response, no_content, not_found

API_KEY_PROJECTION = {
    "_id": False,
    "user": False
}

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
        "allowed": virtool.analyses.ALGORITHM_NAMES,
        "required": False
    }
}

routes = virtool.http.routes.Routes()


@routes.get("/api/account")
async def get(req):
    """
    Get complete user document

    """
    user_id = req["client"].user_id

    document = await req.app["db"].users.find_one(user_id, virtool.db.users.ACCOUNT_PROJECTION)

    return json_response(virtool.utils.base_processor(document))


@routes.patch("/api/account", schema={
    "email": {
        "type": "string",
        "coerce": virtool.validators.strip,
        "regex": "^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$"
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
    data = await req.json()
    user_id = req["client"].user_id

    password = data.get("password", None)

    if password is not None and len(password) < req.app["settings"]["minimum_password_length"]:
        raise bad_request("Password does not meet minimum length requirement")

    update = dict()

    if password:
        try:
            update = await virtool.db.account.compose_password_update(
                db,
                user_id,
                data["old_password"],
                password
            )
        except ValueError as err:
            if "Invalid credentials" in str(err):
                return bad_request("Invalid credentials")
            raise

    if "email" in data:
        update["email"] = data["email"]

    document = await db.users.find_one_and_update({"_id": user_id}, {
        "$set": update
    }, projection=virtool.db.users.ACCOUNT_PROJECTION)

    return json_response(virtool.utils.base_processor(document))


@routes.get("/api/account/settings")
async def get_settings(req):
    """
    Get account settings

    """
    user_id = req["client"].user_id

    document = await req.app["db"].users.find_one(user_id)

    return json_response(document["settings"])


@routes.patch("/api/account/settings", schema=SETTINGS_SCHEMA)
async def update_settings(req):
    """
    Update account settings.

    """
    db = req.app["db"]
    data = req["data"]

    user_id = req["client"].user_id

    document = await db.users.find_one(user_id, ["settings"])

    settings = {
        **document["settings"],
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
    key_id = req.match_info.get("key_id")

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
    "administrator": {
        "type": "boolean",
        "default": False
    },
    "permissions": {
        "type": "dict",
        "default": {},
        "validator": virtool.validators.is_permission_dict
    }
})
async def create_api_key(req):
    """
    Create a new API key.

    """
    db = req.app["db"]
    data = req["data"]

    user_id = req["client"].user_id

    name = data["name"]

    user = await db.users.find_one(user_id, ["administrator", "permissions"])

    permissions = {
        **{p: False for p in virtool.users.PERMISSIONS},
        **data["permissions"]
    }

    if not user["administrator"]:
        permissions = virtool.users.limit_permissions(permissions, user["permissions"])

    raw, hashed = virtool.db.account.get_api_key()

    document = {
        "_id": hashed,
        "id": await virtool.db.account.get_alternate_id(db, name),
        "name": name,
        "administrator": user["administrator"] and data["administrator"],
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

    headers = {
        "Location": f"/api/account/keys/{document['id']}"
    }

    return json_response(document, headers=headers, status=201)


@routes.patch("/api/account/keys/{key_id}", schema={
    "administrator": {
        "type": "boolean"
    },
    "permissions": {
        "type": "dict",
        "validator": virtool.validators.is_permission_dict
    }
})
async def update_api_key(req):
    db = req.app["db"]
    data = req["data"]

    key_id = req.match_info.get("key_id")

    if not await db.keys.count({"id": key_id}):
        return not_found()

    user_id = req["client"].user_id

    update = dict()

    user = await db.users.find_one(user_id, ["administrator", "permissions"])

    administrator = data.get("administrator", None)

    if administrator is not None:
        update["administrator"] = administrator and user["administrator"]

    permissions = data.get("permissions", None)

    if permissions:
        # The permissions currently assigned to the API key.
        key_permissions = await virtool.db.utils.get_one_field(
            db.keys,
            "permissions",
            {"id": key_id, "user.id": user_id}
        )

        key_permissions.update(permissions)

        update["permissions"] = virtool.users.limit_permissions(key_permissions, user["permissions"])

    document = await db.keys.find_one_and_update({"id": key_id}, {
        "$set": update
    }, projection={"_id": False, "user": False})

    return json_response(document)


@routes.delete("/api/account/keys/{key_id}")
async def remove_api_key(req):
    db = req.app["db"]

    user_id = req["client"].user_id
    key_id = req.match_info.get("key_id")

    delete_result = await db.keys.delete_one({"id": key_id, "user.id": user_id})

    if delete_result.deleted_count == 0:
        return not_found()

    return no_content()


@routes.delete("/api/account/keys")
async def remove_all_api_keys(req):
    db = req.app["db"]

    await db.keys.delete_many({"user.id": req["client"].user_id})

    return no_content()


@routes.post("/api/account/login", public=True)
async def login(req):
    db = req.app["db"]
    data = await req.json()
    client = req["client"]

    user_id = data.get("username", "")
    password = data.get("password", "")
    key = data.get("key", "")

    # When this value is set, the session will last for 1 month instead of the 1 hour default.
    remember = data.get("remember", False)

    # Check that the hidden verification key matches the one attached to the logging-in session.
    if not await virtool.db.sessions.check_verification_key(db, client.session_id, key):
        return bad_request("Invalid login verification key")

    # Re-render the login page with an error message if the username and/or password are invalid.
    if not await virtool.db.users.validate_credentials(db, user_id, password):
        return bad_request("Invalid username or password")

    # If the user's password needs to be reset, redirect to the reset page without authorizing the session. A one-time
    # reset code is generated and added to the query string.
    if await virtool.db.utils.get_one_field(db.users, "force_reset", user_id):
        return json_response({"reset": True}, status=201)

    old_session_id = req.cookies.get("session_id")

    session, token = await virtool.db.sessions.replace_session(
        db,
        old_session_id,
        virtool.http.auth.get_ip(req),
        user_id,
        remember
    )

    resp = json_response({"reset": False}, status=201)

    resp.set_cookie("session_id", session["_id"])
    resp.set_cookie("session_token", token)

    return resp


@routes.get("/api/account/logout", public=True)
async def logout(req):
    """
    Invalidates the requesting session, effectively logging out the user.

    """
    db = req.app["db"]

    old_session_id = req.cookies.get("session_id")

    session, _ = await virtool.db.sessions.replace_session(
        db,
        old_session_id,
        virtool.http.auth.get_ip(req)
    )

    new_session_id = session["_id"]

    verification_key = await virtool.db.sessions.get_verification_key(db, new_session_id)

    resp = json_response({
        "login_verification_key": verification_key
    }, status=200)

    resp.set_cookie("session_id", session["_id"])
    resp.del_cookie("session_token")

    return resp
