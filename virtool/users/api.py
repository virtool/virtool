"""
Work with user documents in the database.

Schema:
- _id (str) username
- administrator (bool) true if the user is an administrator
- email (str) the user's email address
- force_reset (bool) the user must reset their password on next login
- groups (List[str]) a list of group IDs the user is a member of
- last_password_change (datetime) a timestamp for the last time the password was changed
- password (str) a salted and bcrypt-hashed password for the user
- permissions (Object) a object of permissions keys with boolean values indicating if the user has that permission
- primary_group (str) the ID of a group that can automatically gain ownership of samples created by the user
- settings (Object) user-specific settings - currently not used

"""
import virtool.http.auth
import virtool.http.routes
import virtool.users.db
import virtool.validators
from aiohttp.web_exceptions import HTTPBadRequest, HTTPConflict, HTTPNoContent
from virtool.api.response import NotFound, json_response
from virtool.api.utils import compose_regex_query, paginate
from virtool.db.utils import apply_projection
from virtool.errors import DatabaseError
from virtool.http.schema import schema
from virtool.http.utils import set_session_id_cookie, set_session_token_cookie
from virtool.users.checks import check_password_length
from virtool.users.sessions import create_session
from virtool.utils import base_processor

routes = virtool.http.routes.Routes()


@routes.get("/users", admin=True)
async def find(req):
    """
    Get a list of all user documents in the database.

    """
    db = req.app["db"]

    term = req.query.get("find")

    db_query = dict()

    if term:
        db_query.update(compose_regex_query(term, ["_id"]))

    data = await paginate(
        db.users,
        db_query,
        req.query,
        sort="_id",
        projection=virtool.users.db.PROJECTION,
    )

    return json_response(data)


@routes.get("/users/{user_id}", admin=True)
async def get(req):
    """
    Get a near-complete user document. Password data are removed.

    """
    document = await req.app["db"].users.find_one(
        req.match_info["user_id"], virtool.users.db.PROJECTION
    )

    if not document:
        raise NotFound()

    return json_response(base_processor(document))


@routes.post("/users", admin=True)
@schema(
    {
        "handle": {
            "type": "string",
            "coerce": virtool.validators.strip,
            "empty": False,
            "required": True,
        },
        "password": {"type": "string", "empty": False, "required": True},
        "force_reset": {"type": "boolean", "default": True},
    }
)
async def create(req):
    """
    Add a new user to the user database.

    """
    db = req.app["db"]
    data = await req.json()

    handle = data["handle"]
    if handle == "virtool":
        raise HTTPBadRequest(text="Reserved user name: virtool")

    error = await check_password_length(req)

    if error:
        raise HTTPBadRequest(text=error)

    try:
        document = await virtool.users.db.create(
            db, data["password"], handle=handle, force_reset=data["force_reset"]
        )
    except DatabaseError:
        raise HTTPBadRequest(text="User already exists")

    user_id = document["_id"]
    headers = {"Location": f"/users/{user_id}"}

    return json_response(
        base_processor({key: document[key] for key in virtool.users.db.PROJECTION}),
        headers=headers,
        status=201,
    )


@routes.put("/users/first", public=True)
@schema(
    {
        "handle": {
            "type": "string",
            "coerce": virtool.validators.strip,
            "empty": False,
            "required": True,
        },
        "password": {"type": "string", "empty": False, "required": True},
    }
)
async def create_first(req):
    """
    Add a first user to the user database.

    """
    db = req.app["db"]
    data = await req.json()

    if await db.users.count_documents({}):
        raise HTTPConflict(text="Virtool already has at least one user")

    if data["handle"] == "virtool":
        raise HTTPBadRequest(text="Reserved user name: virtool")

    error = await check_password_length(req)

    if error:
        raise HTTPBadRequest(text=error)

    handle = data["handle"]

    document = await virtool.users.db.create(
        db, data["password"], handle=handle, force_reset=False
    )
    user_id = document["_id"]

    document = await virtool.users.db.edit(db, user_id, administrator=True)

    headers = {"Location": f"/users/{user_id}"}

    session, token = await create_session(db, virtool.http.auth.get_ip(req), user_id)

    req["client"].authorize(session, is_api=False)

    resp = json_response(
        base_processor({key: document[key] for key in virtool.users.db.PROJECTION}),
        headers=headers,
        status=201,
    )

    set_session_id_cookie(resp, session["_id"])
    set_session_token_cookie(resp, token)

    return resp


@routes.patch("/users/{user_id}", admin=True)
@schema(
    {
        "administrator": {"type": "boolean"},
        "force_reset": {"type": "boolean"},
        "groups": {"type": "list"},
        "password": {"type": "string"},
        "primary_group": {"type": "string"},
    }
)
async def edit(req):
    db = req.app["db"]
    data = await req.json()

    if "password" in data:
        error = await check_password_length(req)

        if error:
            raise HTTPBadRequest(text=error)

    groups = await db.groups.distinct("_id")

    if "groups" in data:
        missing = [g for g in data["groups"] if g not in groups]

        if missing:
            raise HTTPBadRequest(text="Groups do not exist: " + ", ".join(missing))

    primary_group = data.get("primary_group")

    if primary_group and primary_group not in groups:
        raise HTTPBadRequest(text="Primary group does not exist")

    user_id = req.match_info["user_id"]

    if "administrator" in data and user_id == req["client"].user_id:
        raise HTTPBadRequest(text="Users cannot modify their own administrative status")

    try:
        document = await virtool.users.db.edit(db, user_id, **data)
    except DatabaseError as err:
        if "User does not exist" in str(err):
            raise NotFound("User does not exist")

        if "User is not member of group" in str(err):
            raise HTTPConflict(text="User is not member of group")

        raise

    projected = apply_projection(document, virtool.users.db.PROJECTION)

    return json_response(base_processor(projected))


@routes.delete("/users/{user_id}", admin=True)
async def remove(req):
    """
    Remove a user.

    """
    db = req.app["db"]

    user_id = req.match_info["user_id"]

    if user_id == req["client"].user_id:
        raise HTTPBadRequest(text="Cannot remove own account")

    delete_result = await db.users.delete_one({"_id": user_id})

    # Remove user from all references.
    await db.references.update_many({}, {"$pull": {"users": {"id": user_id}}})

    if delete_result.deleted_count == 0:
        raise NotFound()

    raise HTTPNoContent
