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
- permissions (Object) a object of permissions keys with boolean values
                       indicating if the user has that permission
- primary_group (str) the ID of a group that can automatically
                      gain ownership of samples created by the user
- settings (Object) user-specific settings - currently not used

"""
from typing import Union

from aiohttp_pydantic import PydanticView
from aiohttp_pydantic.oas.typing import r200, r201, r204, r400, r403, r404, r409

import virtool.http.auth
import virtool.http.routes
import virtool.users.db
from aiohttp.web_exceptions import HTTPBadRequest, HTTPConflict, HTTPNoContent
from virtool.api.response import NotFound, json_response
from virtool.api.utils import compose_regex_query, paginate
from virtool.data_model.user import VirtoolUser
from virtool.http.privileges import admin, public
from virtool.mongo.utils import apply_projection
from virtool.errors import DatabaseError
from virtool.http.utils import set_session_id_cookie, set_session_token_cookie
from virtool.users.checks import check_password_length
from virtool.users.oas import CreateUserSchema, CreateFirstUserSchema, EditUserSchema
from virtool.users.sessions import create_session
from virtool.utils import base_processor

routes = virtool.http.routes.Routes()


@routes.view("/users")
class UsersView(PydanticView):

    @admin
    async def get(self) -> Union[r201[VirtoolUser], r403]:
        """
        Get a list of all user documents in the database.

        Status Codes:
            200: Successful operation
            403: Not permitted
        """
        db = self.request.app["db"]

        term = self.request.query.get("find")

        db_query = {}
        if term:
            db_query.update(compose_regex_query(term, ["_id"]))

        data = await paginate(
            db.users,
            db_query,
            self.request.query,
            sort="handle",
            projection=virtool.users.db.PROJECTION,
        )

        return json_response(data)

    @admin
    async def post(self, data: CreateUserSchema) -> Union[r201[VirtoolUser], r400, r403]:
        """
        Add a new user to the user database.

        Status Codes:
            201: Successful operation
            400: User already exists
            400: Password does not meet length requirement
            403: Not permitted
        """
        db = self.request.app["db"]

        handle = data.handle
        password = data.password
        force_reset = data.force_reset

        if handle == "virtool":
            raise HTTPBadRequest(text="Reserved user name: virtool")

        error = await check_password_length(self.request, password=password)

        if error:
            raise HTTPBadRequest(text=error)

        try:
            document = await virtool.users.db.create(
                db, password=password, handle=handle, force_reset=force_reset
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


@routes.view("/users/{user_id}")
class UserView(PydanticView):

    @admin
    async def get(self) -> Union[r200[VirtoolUser], r403, r404]:
        """
        Get a near-complete user document. Password data are removed.

        Status Codes:
            200: Successful operation
            403: Not permitted
            404: User not found
        """
        document = await self.request.app["db"].users.find_one(
            self.request.match_info["user_id"], virtool.users.db.PROJECTION
        )

        if not document:
            raise NotFound()

        return json_response(base_processor(document))

    @admin
    async def patch(self, data: EditUserSchema) -> Union[r200[VirtoolUser], r400, r403, r404, r409]:
        """
        Change the password, primary group, or force reset setting of an existing user.

        Status Codes:
            200: Successful operation
            400: Primary group does not exist
            400: Users cannot modify their own administrative status
            403: Not permitted
            404: Not found
            409: User is not member of group
        """

        db = self.request.app["db"]

        if data.password is not None:
            error = await check_password_length(self.request, password=data.password)

            if error:
                raise HTTPBadRequest(text=error)

        groups = await db.groups.distinct("_id")

        if data.groups is not None:
            missing = [g for g in data.groups if g not in groups]

            if missing:
                raise HTTPBadRequest(text="Groups do not exist: " + ", ".join(missing))

        primary_group = data.primary_group

        if primary_group and primary_group not in groups:
            raise HTTPBadRequest(text="Primary group does not exist")

        user_id = self.request.match_info["user_id"]

        if data.administrator is not None and user_id == self.request["client"].user_id:
            raise HTTPBadRequest(text="Users cannot modify their own administrative status")

        try:
            document = await virtool.users.db.edit(db, user_id, **data.__dict__)
        except DatabaseError as err:
            if "User does not exist" in str(err):
                raise NotFound("User does not exist")

            if "User is not member of group" in str(err):
                raise HTTPConflict(text="User is not member of group")

            raise

        projected = apply_projection(document, virtool.users.db.PROJECTION)

        return json_response(base_processor(projected))

    @admin
    async def delete(self) -> Union[r204, r400, r403, r404]:
        """
        Remove a user.

        Status Codes:
            204: No content
            400: Cannot remove own account
            403: Not permitted
            404: Not found
        """
        db = self.request.app["db"]

        user_id = self.request.match_info["user_id"]

        if user_id == self.request["client"].user_id:
            raise HTTPBadRequest(text="Cannot remove own account")

        delete_result = await db.users.delete_one({"_id": user_id})

        # Remove user from all references.
        await db.references.update_many({}, {"$pull": {"users": {"id": user_id}}})

        if delete_result.deleted_count == 0:
            raise NotFound()

        raise HTTPNoContent


@routes.view("/users/first")
class FirstUserView(PydanticView):

    @public
    async def put(self, data: CreateFirstUserSchema) -> Union[r201[VirtoolUser], r400, r403]:
        """
        Add a first user to the user database.

        Status Codes:
            201: Successful operation
            400: User already exists
            403: Not permitted
        """
        db = self.request.app["db"]

        if await db.users.count_documents({}):
            raise HTTPConflict(text="Virtool already has at least one user")

        if data["handle"] == "virtool":
            raise HTTPBadRequest(text="Reserved user name: virtool")

        error = await check_password_length(self.request, password=data.password)

        if error:
            raise HTTPBadRequest(text=error)

        handle = data.handle
        password = data.password

        document = await virtool.users.db.create(
            db, password=password, handle=handle, force_reset=False
        )
        user_id = document["_id"]

        document = await virtool.users.db.edit(db, user_id, administrator=True)

        headers = {"Location": f"/users/{user_id}"}

        session, token = await create_session(db, virtool.http.auth.get_ip(self.request), user_id)

        self.request["client"].authorize(session, is_api=False)

        resp = json_response(
            base_processor({key: document[key] for key in virtool.users.db.PROJECTION}),
            headers=headers,
            status=201,
        )

        set_session_id_cookie(resp, session["_id"])
        set_session_token_cookie(resp, token)

        return resp
