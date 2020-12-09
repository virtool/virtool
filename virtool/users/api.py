"""
Work with user documents in the database.

Schema:
- _id (str) username
- administrator (bool) true if the user is an administrator
- email (str) the user's email address
- force_reset (bool) the user must reset their password on next login
- groups (List[str]) a list of group IDs the user is a member of
- identicon (str) a string used to render identicons for the user
- last_password_change (datetime) a timestamp for the last time the password was changed
- password (str) a salted and bcrypt-hashed password for the user
- permissions (Object) a object of permissions keys with boolean values indicating if the user has that permission
- primary_group (str) the ID of a group that can automatically gain ownership of samples created by the user
- settings (Object) user-specific settings - currently not used

"""
import virtool.api.utils
import virtool.http.utils
import virtool.users.checks
import virtool.hmm.db
import virtool.users.sessions
import virtool.users.db
import virtool.db.utils
import virtool.errors
import virtool.groups.utils
import virtool.http.auth
import virtool.http.routes
import virtool.users.utils
import virtool.utils
import virtool.validators
from virtool.api.response import bad_request, conflict, json_response, no_content, not_found

routes = virtool.http.routes.Routes()


@routes.get("/api/users", admin=True)
async def find(req):
    """
    Get a list of all user documents in the database.

    """
    db = req.app["db"]

    term = req.query.get("find")

    db_query = dict()

    if term:
        db_query.update(virtool.api.utils.compose_regex_query(term, ["_id"]))

    data = await virtool.api.utils.paginate(
        db.users,
        db_query,
        req.query,
        sort="_id",
        projection=virtool.users.db.PROJECTION
    )

    return json_response(data)


@routes.get("/api/users/{user_id}", admin=True)
async def get(req):
    """
    Get a near-complete user document. Password data are removed.

    """
    document = await req.app["db"].users.find_one(req.match_info["user_id"], virtool.users.db.PROJECTION)

    if not document:
        return not_found()

    return json_response(virtool.utils.base_processor(document))


@routes.post("/api/users", admin=True, schema={
    "user_id": {
        "type": "string",
        "coerce": virtool.validators.strip,
        "empty": False,
        "required": True
    },
    "password": {
        "type": "string",
        "empty": False,
        "required": True
    },
    "force_reset": {
        "type": "boolean",
        "default": True
    }
})
async def create(req):
    """
    Add a new user to the user database.

    """
    db = req.app["db"]
    data = await req.json()

    if data["user_id"] == "virtool":
        return bad_request("Reserved user name: virtool")

    error = await virtool.users.checks.check_password_length(req)

    if error:
        return bad_request(error)

    user_id = data["user_id"]

    try:
        document = await virtool.users.db.create(
            db,
            user_id,
            data["password"],
            data["force_reset"]
        )
    except virtool.errors.DatabaseError:
        return bad_request("User already exists")

    headers = {
        "Location": f"/api/users/{user_id}"
    }

    return json_response(
        virtool.utils.base_processor({key: document[key] for key in virtool.users.db.PROJECTION}),
        headers=headers,
        status=201
    )


@routes.put("/api/users/first", public=True, schema={
    "user_id": {
        "type": "string",
        "coerce": virtool.validators.strip,
        "empty": False,
        "required": True
    },
    "password": {
        "type": "string",
        "empty": False,
        "required": True
    }
})
async def create_first(req):
    """
    Add a first user to the user database.

    """
    db = req.app["db"]
    data = await req.json()

    if await db.users.count_documents({}):
        return conflict("Virtool already has at least one user")

    if data["user_id"] == "virtool":
        return bad_request("Reserved user name: virtool")

    error = await virtool.users.checks.check_password_length(req)

    if error:
        return bad_request(error)

    user_id = data["user_id"]

    await virtool.users.db.create(
        db,
        user_id,
        data["password"],
        force_reset=False
    )

    document = await virtool.users.db.edit(
        db,
        user_id,
        administrator=True
    )

    headers = {
        "Location": f"/api/users/{user_id}"
    }

    session, token = await virtool.users.sessions.create_session(
        db,
        virtool.http.auth.get_ip(req),
        user_id
    )

    req["client"].authorize(session, is_api=False)

    resp = json_response(
        virtool.utils.base_processor({key: document[key] for key in virtool.users.db.PROJECTION}),
        headers=headers,
        status=201
    )

    virtool.http.utils.set_session_id_cookie(resp, session["_id"])
    virtool.http.utils.set_session_token_cookie(resp, token)

    return resp


@routes.patch("/api/users/{user_id}", admin=True, schema={
    "administrator": {
        "type": "boolean"
    },
    "force_reset": {
        "type": "boolean"
    },
    "groups": {
        "type": "list"
    },
    "password": {
        "type": "string"
    },
    "primary_group": {
        "type": "string"
    }
})
async def edit(req):
    db = req.app["db"]
    data = await req.json()

    if "password" in data:
        error = await virtool.users.checks.check_password_length(req)

        if error:
            return bad_request(error)

    groups = await db.groups.distinct("_id")

    if "groups" in data:
        missing = [g for g in data["groups"] if g not in groups]

        if missing:
            return bad_request("Groups do not exist: " + ", ".join(missing))

    primary_group = data.get("primary_group")

    if primary_group and primary_group not in groups:
        return bad_request("Primary group does not exist")

    user_id = req.match_info["user_id"]

    if "administrator" in data and user_id == req["client"].user_id:
        return bad_request("Users cannot modify their own administrative status")

    try:
        document = await virtool.users.db.edit(
            db,
            user_id,
            **data
        )
    except virtool.errors.DatabaseError as err:
        if "User does not exist" in str(err):
            return not_found("User does not exist")

        if "User is not member of group" in str(err):
            return conflict("User is not member of group")

        raise

    projected = virtool.db.utils.apply_projection(document, virtool.users.db.PROJECTION)

    return json_response(virtool.utils.base_processor(projected))


@routes.delete("/api/users/{user_id}", admin=True)
async def remove(req):
    """
    Remove a user.

    """
    db = req.app["db"]

    user_id = req.match_info["user_id"]

    if user_id == req["client"].user_id:
        return bad_request("Cannot remove own account")

    delete_result = await db.users.delete_one({"_id": user_id})

    # Remove user from all references.
    await db.references.update_many({}, {
        "$pull": {
            "users": {
                "id": user_id
            }
        }
    })

    if delete_result.deleted_count == 0:
        return not_found()

    return no_content()
