import asyncio
from typing import Union


from aiohttp.web_response import Response
from aiohttp_pydantic import PydanticView
from aiohttp_pydantic.oas.typing import r200, r404, r202, r400, r201, r403
from virtool_core.models.roles import AdministratorRole
from virtool_core.models.user import User
from virtool_core.utils import document_enum

from virtool.administrators.oas import (
    UpdateAdministratorRoleRequest,
    ListAdministratorResponse,
    ListRolesResponse,
    UpdateUserRequest,
    UserResponse,
    RunActionRequest,
)
from virtool.api.errors import APINotFound, APIBadRequest, APIForbidden
from virtool.api.custom_json import json_response
from virtool.authorization.client import (
    AuthorizationClient,
    get_authorization_client_from_req,
)
from virtool.data.errors import (
    ResourceNotFoundError,
    ResourceError,
    ResourceConflictError,
)
from virtool.data.utils import get_data_from_req
from virtool.api.policy import policy, AdministratorRoutePolicy
from virtool.api.routes import Routes
from virtool.flags import flag, FlagName
from virtool.users.checks import check_password_length
from virtool.users.oas import CreateUserRequest

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
        """
        List administrator roles.

        Status Codes:
            200: Successful operation
        """
        return json_response(AVAILABLE_ROLES)


@routes.view("/admin/users")
class AdminUsersView(PydanticView):
    @policy(AdministratorRoutePolicy(AdministratorRole.USERS))
    async def get(
        self, administrator: bool | None = None, term: str | None = None
    ) -> r200[ListAdministratorResponse]:
        """
        Find users.

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
                administrator,
                term,
            )
        )

    @policy(AdministratorRoutePolicy(AdministratorRole.USERS))
    async def post(self, data: CreateUserRequest) -> r201[User] | r400 | r403:
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
            raise APIBadRequest("Reserved user name: virtool")

        if error := await check_password_length(self.request, password=data.password):
            raise APIBadRequest(error)

        try:
            user = await get_data_from_req(self.request).users.create(
                data.handle, data.password, data.force_reset
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
    async def get(self, user_id: str, /) -> r200[UserResponse] | r404:
        """
        Get a user.

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
        self, user_id: str, /, data: UpdateUserRequest
    ) -> r200[UserResponse] | r404:
        """
        Update a user.

        Status Codes:
            200: Successful operation
            404: User not found
        """

        if not await check_administrator_can_update_user(
            get_authorization_client_from_req(self.request),
            self.request["client"].user_id,
            user_id,
        ):
            raise APIForbidden(
                "Insufficient privileges", error_id="insufficient_privileges"
            )

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
        self, user_id: str, /, data: UpdateAdministratorRoleRequest
    ) -> Union[r200[UserResponse], r404]:
        """
        Set administrator role.

        Updates the user's administrator role.

        Status Codes:
            201: Successful operation
            404: User not found
        """

        if user_id == self.request["client"].user_id:
            raise APIBadRequest("Cannot change own role")

        try:
            administrator = await get_data_from_req(
                self.request
            ).users.set_administrator_role(user_id, data.role)
        except ResourceNotFoundError:
            raise APINotFound()

        return json_response(administrator, status=200)


@routes.view("/admin/actions")
class AdminActionsView(PydanticView):
    @policy(AdministratorRoutePolicy(AdministratorRole.FULL))
    async def put(self, data: RunActionRequest) -> Union[r202, r400]:
        """
        Initiate an action

        Starts an action with the given name.

        Status Codes:
            200: Successful operation
            404: User not found
        """

        try:
            await get_data_from_req(self.request).administrators.run_action(data.name)
        except ResourceError:
            raise APIBadRequest("Invalid action name")

        return Response(status=202)


async def check_administrator_can_update_user(
    authorization_client: AuthorizationClient, req_user_id: str, user_id: str
) -> bool:
    """
    Check if an administrator user has sufficient permissions to update another user

    Returns True if the user to be edited is not an administrator or if the requesting
    user is a full administrator.

    :param authorization_client: the authorization client
    :param req_user_id: the requesting user id
    :param user_id: the id of the user being updated

    """
    admin_tuple, req_admin_tuple = await asyncio.gather(
        authorization_client.get_administrator(user_id),
        authorization_client.get_administrator(req_user_id),
    )

    if admin_tuple[1] is None:
        return True

    if req_admin_tuple[1] == AdministratorRole.FULL:
        return True

    return False
