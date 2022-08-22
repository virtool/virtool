from typing import Union

from aiohttp.web_exceptions import HTTPBadRequest, HTTPConflict, HTTPNoContent
from aiohttp_pydantic import PydanticView
from aiohttp_pydantic.oas.typing import r200, r201, r204, r400, r403, r404, r409
from virtool_core.models.user import User

import virtool.http.auth
import virtool.users.db
from virtool.api.response import NotFound, json_response
from virtool.api.utils import compose_regex_query, paginate
from virtool.data.errors import ResourceConflictError, ResourceNotFoundError
from virtool.data.utils import get_data_from_req
from virtool.http.policy import (
    policy,
    AdministratorRoutePolicy,
    PublicRoutePolicy,
)
from virtool.http.routes import Routes
from virtool.http.utils import set_session_id_cookie, set_session_token_cookie
from virtool.users.checks import check_password_length
from virtool.users.oas import (
    UpdateUserSchema,
    CreateUserSchema,
    CreateFirstUserSchema,
)
from virtool.users.sessions import create_session

routes = Routes()


@routes.view("/users")
class UsersView(PydanticView):
    @policy(AdministratorRoutePolicy)
    async def get(self) -> Union[r200, r403]:
        """
        List all users.

        Returns a paginated list of all users in the instance.

        Status Codes:
            200: Successful operation
            403: Not permitted
        """
        db = self.request.app["db"]

        term = self.request.query.get("find")

        db_query = compose_regex_query(term, ["_id"]) if term else {}

        data = await paginate(
            db.users,
            db_query,
            self.request.query,
            sort="handle",
            projection=virtool.users.db.PROJECTION,
        )

        return json_response(data)

    @policy(AdministratorRoutePolicy)
    async def post(self, data: CreateUserSchema) -> Union[r201[User], r400, r403]:
        """
        Create a user.

        Creates a new user.

        Status Codes:
            201: Successful operation
            400: User already exists
            400: Password does not meet length requirement
            403: Not permitted
        """
        if data.handle == "virtool":
            raise HTTPBadRequest(text="Reserved user name: virtool")

        if error := await check_password_length(self.request, password=data.password):
            raise HTTPBadRequest(text=error)

        try:
            user = await get_data_from_req(self.request).users.create(
                data.handle, data.password, data.force_reset
            )
        except ResourceConflictError as err:
            raise HTTPBadRequest(text=str(err))

        return json_response(
            user,
            headers={"Location": f"/users/{user.id}"},
            status=201,
        )


@routes.view("/users/first")
class FirstUserView(PydanticView):
    @policy(PublicRoutePolicy)
    async def put(self, data: CreateFirstUserSchema) -> Union[r201[User], r400, r403]:
        """
        Create a first user.

        Creates the first user for the instance. This endpoint will not succeed more
        than once.

        After calling this endpoint, authenticate as the first user and use those
        credentials to continue interacting with the API.

        Status Codes:
            201: Successful operation
            400: Bad request
            403: Not permitted
        """
        db = self.request.app["db"]

        if await db.users.count_documents({}):
            raise HTTPConflict(text="Virtool already has at least one user")

        if data.handle == "virtool":
            raise HTTPBadRequest(text="Reserved user name: virtool")

        if error := await check_password_length(self.request, password=data.password):
            raise HTTPBadRequest(text=error)

        user = await get_data_from_req(self.request).users.create_first(
            data.handle, data.password
        )

        session, token = await create_session(
            db, virtool.http.auth.get_ip(self.request), user.id
        )

        self.request["client"].authorize(session, is_api=False)

        response = json_response(
            user.dict(),
            headers={"Location": f"/users/{user.id}"},
            status=201,
        )

        set_session_id_cookie(response, session["_id"])
        set_session_token_cookie(response, token)

        return response


@routes.view("/users/{user_id}")
class UserView(PydanticView):
    @policy(AdministratorRoutePolicy)
    async def get(self) -> Union[r200[User], r403, r404]:
        """
        Retrieve a user.

        Returns the details for a user.

        Status Codes:
            200: Success
            403: Not permitted
            404: Not found
        """
        try:
            user = await get_data_from_req(self.request).users.get(
                self.request.match_info["user_id"]
            )
        except ResourceNotFoundError:
            raise NotFound()

        return json_response(user)

    @policy(AdministratorRoutePolicy)
    async def patch(
        self, data: UpdateUserSchema
    ) -> Union[r200[User], r400, r403, r404, r409]:
        """
        Update a user.

        Updates and existing user with the provided parameters.  Users cannot modify
        their own administrative status.

        Status Codes:
            200: Successful operation
            400: Primary group does not exist
            400: Bad request
            403: Not permitted
            404: Not found
            409: User is not member of group
        """
        user_id = self.request.match_info["user_id"]

        if data.password is not None:
            if error := await check_password_length(
                self.request, password=data.password
            ):
                raise HTTPBadRequest(text=error)

        if data.administrator is not None and user_id == self.request["client"].user_id:
            raise HTTPBadRequest(
                text="Users cannot modify their own administrative status"
            )

        try:
            user = await get_data_from_req(self.request).users.update(user_id, data)
        except ResourceConflictError as err:
            raise HTTPBadRequest(text=str(err))
        except ResourceNotFoundError:
            raise NotFound("User does not exist")

        return json_response(user)

    @policy(AdministratorRoutePolicy)
    async def delete(self) -> Union[r204, r400, r403, r404]:
        """
        Delete a user.

        Deletes an existing user. Users cannot delete their own accounts.

        Status Codes:
            204: No content
            400: Bad request
            403: Not permitted
            404: Not found
        """
        user_id = self.request.match_info["user_id"]

        if user_id == self.request["client"].user_id:
            raise HTTPBadRequest(text="Cannot remove own account")

        try:
            await get_data_from_req(self.request).users.delete(user_id)
        except ResourceNotFoundError:
            raise NotFound

        raise HTTPNoContent
