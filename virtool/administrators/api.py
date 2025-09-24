"""Routes for administrative functions."""

from aiohttp_pydantic import PydanticView
from aiohttp_pydantic.oas.typing import r200, r201, r400, r403, r404
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from virtool.administrators.oas import (
    ListAdministratorResponse,
    ListRolesResponse,
    UpdateAdministratorRoleRequest,
    UpdateUserRequest,
)
from virtool.api.custom_json import json_response
from virtool.api.errors import APIBadRequest, APIForbidden, APINotFound
from virtool.api.policy import AdministratorRoutePolicy, policy
from virtool.api.routes import Routes
from virtool.data.errors import (
    ResourceConflictError,
    ResourceNotFoundError,
)
from virtool.data.utils import get_data_from_req
from virtool.doc import document_enum
from virtool.flags import FlagName, flag
from virtool.models.roles import AdministratorRole
from virtool.users.checks import check_password_length
from virtool.users.models import User
from virtool.users.oas import CreateUserRequest
from virtool.users.pg import SQLUser

routes = Routes()

AVAILABLE_ROLES = [
    {"id": role, "name": role.capitalize(), "description": role.__doc__}
    for role in document_enum(AdministratorRole)
]


@routes.view("/admin/roles")
@flag(FlagName.ADMINISTRATOR_ROLES)
class RolesView(PydanticView):
    @policy(AdministratorRoutePolicy(AdministratorRole.BASE))
    async def get(self) -> r200[ListRolesResponse]:
        """List administrator roles.

        Status Codes:
            200: Successful operation
        """
        return json_response(AVAILABLE_ROLES)


@routes.view("/admin/users")
class AdminUsersView(PydanticView):
    @policy(AdministratorRoutePolicy(AdministratorRole.USERS))
    async def get(
        self,
        active: bool = True,
        administrator: bool | None = None,
        term: str | None = None,
    ) -> r200[ListAdministratorResponse]:
        """Find users.

        Returns a paginated list of users.

        Status Codes:
            200: Successful operation
        """
        url_query = self.request.query

        try:
            page = int(url_query["page"])
        except (KeyError, ValueError):
            page = 1

        try:
            per_page = int(url_query["per_page"])
        except (KeyError, ValueError):
            per_page = 25

        return json_response(
            await get_data_from_req(self.request).users.find(
                page,
                per_page,
                active,
                administrator,
                term,
            ),
        )

    @policy(AdministratorRoutePolicy(AdministratorRole.USERS))
    async def post(self, data: CreateUserRequest) -> r201[User] | r400 | r403:
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
            headers={"Location": f"/admin/users/{user.id}"},
            status=201,
        )


@routes.view("/admin/users/{user_id}")
class AdminUserView(PydanticView):
    @policy(AdministratorRoutePolicy(AdministratorRole.USERS))
    async def get(self, user_id: int, /) -> r200[User] | r404:
        """Get a user.

        Fetches the details of a user.

        Status Codes:
            200: Successful operation
            404: User not found
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
    ) -> r200[User] | r404:
        """Update a user.

        Status Codes:
            200: Successful operation
            404: User not found
        """
        req_user_id = self.request["client"].user_id

        async with AsyncSession(get_data_from_req(self.request).users._pg) as session:
            result = await session.execute(
                select(SQLUser.id, SQLUser.administrator_role).where(
                    SQLUser.id.in_([req_user_id, user_id])
                )
            )
            user_roles = {user_id: role for user_id, role in result.fetchall()}

        target_role = user_roles.get(user_id)
        req_role = user_roles.get(req_user_id)

        if target_role is not None and req_role != AdministratorRole.FULL:
            raise APIForbidden(
                "Insufficient privileges", error_id="insufficient_privileges"
            )

        if data.password is not None:
            if error := await check_password_length(
                self.request,
                password=data.password,
            ):
                raise APIBadRequest(error)

        try:
            user = await get_data_from_req(self.request).users.update(user_id, data)
        except ResourceNotFoundError:
            raise APINotFound()
        except ResourceConflictError as err:
            raise APIBadRequest(str(err))

        return json_response(user)


@routes.view("/admin/users/{user_id}/role")
class AdminRoleView(PydanticView):
    @policy(AdministratorRoutePolicy(AdministratorRole.FULL))
    async def put(
        self,
        user_id: int,
        /,
        data: UpdateAdministratorRoleRequest,
    ) -> r200[User] | r404:
        """Set administrator role.

        Updates the user's administrator role.

        Status Codes:
            201: Successful operation
            404: User not found
        """
        if user_id == self.request["client"].user_id:
            raise APIBadRequest("Cannot change own role")

        try:
            administrator = await get_data_from_req(
                self.request,
            ).users.set_administrator_role(user_id, data.role)
        except ResourceNotFoundError:
            raise APINotFound()

        return json_response(administrator, status=200)
