from cerberus import Validator

import virtool.db.users
import virtool.db.utils
import virtool.errors
import virtool.groups
import virtool.http.routes
import virtool.users
import virtool.utils
from virtool.api.utils import bad_request, conflict, invalid_input, json_response, no_content, not_found


routes = virtool.http.routes.Routes()


@routes.get("/api/users", admin=True)
async def find(req):
    """
    Get a list of all user documents in the database.

    """
    users = await req.app["db"].users.find({}, virtool.db.users.PROJECTION).to_list(None)

    return json_response([virtool.utils.base_processor(user) for user in users])


@routes.get("/api/users/{user_id}", admin=True)
async def get(req):
    """
    Get a near-complete user document. Password data are removed.

    """
    document = await req.app["db"].users.find_one(req.match_info["user_id"], virtool.db.users.PROJECTION)

    if not document:
        return not_found()

    return json_response(virtool.utils.base_processor(document))


@routes.post("/api/users", admin=True)
async def create(req):
    """
    Add a new user to the user database.

    """
    db = req.app["db"]
    data = await req.json()

    v = Validator({
        "user_id": {"type": "string", "minlength": 1, "required": True},
        "password": {"type": "string", "minlength": req.app["settings"]["minimum_password_length"], "required": True},
        "force_reset": {"type": "boolean", "default": True}
    }, purge_unknown=True)

    if not v.validate(data):
        return invalid_input(v.errors)

    user_id = data["user_id"]

    try:
        document = await virtool.db.users.create(db, user_id, data["password"], data["force_reset"])
    except virtool.errors.DatabaseError:
        return conflict("User already exists")

    headers = {
        "Location": "/api/users/" + user_id
    }

    return json_response(
        virtool.utils.base_processor({key: document[key] for key in virtool.db.users.PROJECTION}),
        headers=headers,
        status=201
    )


@routes.patch("/api/users/{user_id}", admin=True)
async def edit(req):
    db = req.app["db"]
    data = await req.json()

    groups = await db.groups.distinct("_id")

    v = Validator({
        "administrator": {"type": "boolean"},
        "force_reset": {"type": "boolean"},
        "groups": {"type": "list", "allowed": groups},
        "password": {"type": "string", "minlength": req.app["settings"]["minimum_password_length"]},
        "primary_group": {"type": "string"}
    }, purge_unknown=True)

    if not v.validate(data):
        return invalid_input(v.errors)

    user_id = req.match_info["user_id"]

    try:
        document = await virtool.db.users.edit(
            db,
            user_id,
            **data
        )
    except virtool.errors.DatabaseError as err:
        if "User does not exist" in str(err):
            return not_found("User does not exist")

        if "Non-existent group" in str(err):
            return not_found("Group does not exist")

        if "User is not member of group" in str(err):
            return conflict("User is not member of group")

        raise

    projected = virtool.db.utils.apply_projection(document, virtool.db.users.PROJECTION)

    return json_response(virtool.utils.base_processor(projected))


@routes.delete("/api/users/{user_id}", admin=True)
async def remove(req):
    """
    Remove a user.

    """
    user_id = req.match_info["user_id"]

    if user_id == req["client"].user_id:
        return bad_request("Cannot remove own account")

    delete_result = await req.app["db"].users.delete_one({"_id": user_id})

    if delete_result.deleted_count == 0:
        return not_found()

    return no_content()
