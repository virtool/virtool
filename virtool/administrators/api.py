import asyncio
from typing import Union, Optional

from aiohttp.web_exceptions import HTTPForbidden, HTTPBadRequest
from aiohttp_pydantic import PydanticView
from aiohttp_pydantic.oas.typing import r200, r404
from virtool_core.models.roles import AdministratorRole
from virtool_core.utils import document_enum

from virtool.administrators.oas import (
    UpdateAdministratorRoleRequest,
    ListAdministratorResponse,
    ListRolesResponse,
    UpdateUserRequest,
    UserResponse,
)
from virtool.api.response import NotFound, json_response
from virtool.authorization.client import AuthorizationClient
from virtool.authorization.utils import get_authorization_client_from_req
from virtool.data.errors import ResourceNotFoundError
from virtool.data.utils import get_data_from_req
from virtool.http.policy import policy, AdministratorRoutePolicy
from virtool.http.routes import Routes
from virtool.flags import flag

routes = Routes()

AVAILABLE_ROLES = [
    {"id": role, "name": role.capitalize(), "description": role.__doc__}
    for role in document_enum(AdministratorRole)
]


@routes.view("/admin/roles")
@flag("FF_ADMINISTRATOR_ROLES")
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
        self, administrator: Optional[bool] = None, term: Optional[str] = None
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
            await get_data_from_req(self.request).administrators.find(
                page,
                per_page,
                administrator,
                term,
            )
        )


@routes.view("/admin/users/{user_id}")
class AdminUserView(PydanticView):
    @policy(AdministratorRoutePolicy(AdministratorRole.USERS))
    async def get(self, user_id: str, /) -> Union[r200[UserResponse], r404]:
        """
        Get a user.

        Fetches the details of a user.

        Status Codes:
            200: Successful operation
            404: User not found
        """

        try:
            user = await get_data_from_req(self.request).administrators.get(user_id)
        except ResourceNotFoundError:
            raise NotFound()

        return json_response(user)

    @policy(AdministratorRoutePolicy(AdministratorRole.USERS))
    async def patch(
        self, user_id: str, /, data: UpdateUserRequest
    ) -> Union[r200[UserResponse], r404]:
        """
        Update a user.

        Status Codes:
            200: Successful operation
            404: User not found
        """

        if not await check_can_edit_user(
            get_authorization_client_from_req(self.request),
            self.request["client"].user_id,
            user_id,
        ):
            raise HTTPForbidden(text="Insufficient privileges")

        try:
            user = await get_data_from_req(self.request).administrators.update(
                user_id, data
            )
        except ResourceNotFoundError:
            raise NotFound()

        return json_response(user)


async def check_can_edit_user(
    authorization_client: AuthorizationClient, req_user_id: str, user_id: str
):
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
            raise HTTPBadRequest(text="Cannot change own role")

        try:
            administrator = await get_data_from_req(
                self.request
            ).administrators.set_administrator_role(user_id, data.role)
        except ResourceNotFoundError:
            raise NotFound()

        return json_response(administrator, status=200)
