from aiohttp_pydantic import PydanticView
from aiohttp_pydantic.oas.typing import r200, r201, r400, r403, r404, r409
from pydantic import Field
from structlog import get_logger

import virtool.api.authentication
from virtool.api.custom_json import json_response
from virtool.api.errors import APIBadRequest, APIConflict, APINotFound
from virtool.api.policy import (
    AdministratorRoutePolicy,
    PublicRoutePolicy,
    policy,
)
from virtool.api.routes import Routes
from virtool.api.utils import (
    set_session_id_cookie,
    set_session_token_cookie,
)
from virtool.data.errors import ResourceConflictError, ResourceNotFoundError
from virtool.data.utils import get_data_from_req
from virtool.models.roles import AdministratorRole
from virtool.users.checks import check_password_length
from virtool.users.models import User
from virtool.users.oas import (
    CreateFirstUserRequest,
    CreateUserRequest,
    UpdateUserRequest,
)

routes = Routes()

logger = get_logger("users")


@routes.view("/users")
class UsersView(PydanticView):
    """A view for listing and creating users."""

    async def get(
        self,
        active: bool = Field(
            default=True,
            description="Filter by active status.",
        ),
        find: str | None = Field(
            description="Filter by partial matches to user handles.",
        ),
    ) -> r200[User]:
        """Find users.

        Find all Virtool users.

        The ``active`` query parameter can be used to filter users by their active
        status.

        The ``find`` query parameter can be used to filter users by partial matches to
        their handles.

        Status Codes:
            200: Successful operation
        """
        page = int(self.request.query.get("page", 1))
        per_page = int(self.request.query.get("per_page", 25))

        result = await get_data_from_req(self.request).users.find(
            page=page,
            per_page=per_page,
            active=active,
            administrator=None,
            term=find or "",
        )

        return json_response(
            {
                "documents": [user.dict() for user in result.items],
                "found_count": result.found_count,
                "page": result.page,
                "page_count": result.page_count,
                "per_page": result.per_page,
                "total_count": result.total_count,
            }
        )

    @policy(AdministratorRoutePolicy(AdministratorRole.USERS))
    async def post(
        self,
        data: CreateUserRequest,
    ) -> r201[User] | r400 | r403:
        """Create a user.

        Creates a new user.

        Status Codes:
            201: Successful operation
            400: User already exists
            400: Password does not meet length requirement
            403: Not permitted
        """
        if data.handle == "virtool":
            raise APIBadRequest("Reserved user name: virtool")

        if error := await check_password_length(self.request, password=data.password):
            raise APIBadRequest(error)

        try:
            user = await get_data_from_req(self.request).users.create(
                data.handle,
                data.password,
                data.force_reset,
            )
        except ResourceConflictError as err:
            raise APIBadRequest(str(err))

        return json_response(
            user,
            headers={"Location": f"/users/{user.id}"},
            status=201,
        )


@routes.view("/users/first")
class FirstUserView(PydanticView):
    """A view for creating the first user."""

    @policy(PublicRoutePolicy)
    async def put(
        self,
        data: CreateFirstUserRequest,
    ) -> r201[User] | r400 | r403:
        """Create a first user.

        Creates the first user for the instance. This endpoint will not succeed more
        than once.

        After calling this endpoint, authenticate as the first user and use those
        credentials to continue interacting with the API.

        Status Codes:
            201: Successful operation
            400: Bad request
            403: Not permitted
        """
        if await get_data_from_req(self.request).users.check_users_exist():
            logger.error("attempted to create first user when users already exist")
            raise APIConflict("Virtool already has at least one user")

        if data.handle == "virtool":
            raise APIBadRequest("Reserved user name: virtool")

        if error := await check_password_length(self.request, password=data.password):
            raise APIBadRequest(error)

        user = await get_data_from_req(self.request).users.create_first(
            data.handle,
            data.password,
        )

        session, token = await get_data_from_req(
            self.request,
        ).sessions.create_authenticated(
            virtool.api.authentication.get_ip(self.request),
            user.id,
        )

        response = json_response(
            user.dict(),
            headers={"Location": f"/users/{user.id}"},
            status=201,
        )

        set_session_id_cookie(response, session.id)
        set_session_token_cookie(response, token)

        return response


@routes.view("/users/{user_id}")
class UserView(PydanticView):
    """A view for retrieving and updating users."""

    @policy(AdministratorRoutePolicy(AdministratorRole.USERS))
    async def get(self, user_id: int, /) -> r200[User] | r403 | r404:
        """Retrieve a user.

        Fetches the details for a user.

        Status Codes:
            200: Success
            403: Not permitted
            404: Not found
        """
        try:
            user = await get_data_from_req(self.request).users.get(user_id)
        except ResourceNotFoundError:
            raise APINotFound()

        return json_response(user)

    @policy(AdministratorRoutePolicy(AdministratorRole.USERS))
    async def patch(
        self,
        user_id: int,
        /,
        data: UpdateUserRequest,
    ) -> r200[User] | r400 | r403 | r404 | r409:
        """Update a user.

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
        if data.password is not None:
            if error := await check_password_length(
                self.request,
                password=data.password,
            ):
                raise APIBadRequest(error)

        try:
            user = await get_data_from_req(self.request).users.update(user_id, data)
        except ResourceConflictError as err:
            raise APIBadRequest(str(err))
        except ResourceNotFoundError:
            raise APINotFound("User does not exist")

        return json_response(user)
