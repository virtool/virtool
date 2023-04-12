import asyncio
from typing import Union, Optional

from aiohttp.web_exceptions import HTTPForbidden, HTTPBadRequest
from aiohttp_pydantic import PydanticView
from aiohttp_pydantic.oas.typing import r201, r200, r404
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
from virtool.authorization.utils import get_authorization_client_from_req
from virtool.data.errors import ResourceNotFoundError
from virtool.data.utils import get_data_from_req
from virtool.http.policy import policy, AdministratorRoutePolicy
from virtool.http.routes import Routes

routes = Routes()

AVAILABLE_ROLES = [
    {"id": role, "name": role.capitalize(), "description": role.__doc__}
    for role in document_enum(AdministratorRole)
]


@routes.view("/admin/roles")
class AdministratorsView(PydanticView):
    @policy(AdministratorRoutePolicy(AdministratorRole.BASE))
    async def get(self) -> r200[ListRolesResponse]:
        """
        List all available administrator roles.

        Status Codes:
            200: Successful operation
        """
        return json_response(AVAILABLE_ROLES)


@routes.view("/admin/users")
class AdministratorsView(PydanticView):
    @policy(AdministratorRoutePolicy(AdministratorRole.USERS))
    async def get(
        self, administrator: Optional[bool] = None, term: Optional[str] = None
    ) -> r200[ListAdministratorResponse]:
        """
        Get a paginated list of users

        Status Codes:
            200: Successful operation
        """

        return json_response(
            await get_data_from_req(self.request).administrators.find_users(
                self.request.query,
                administrator,
                term,
            )
        )


@routes.view("/admin/users/{user_id}")
class AdministratorView(PydanticView):
    @policy(AdministratorRoutePolicy(AdministratorRole.USERS))
    async def get(self, user_id: str, /) -> Union[r200[UserResponse], r404]:
        """
        Get the complete representation of a user

        Status Codes:
            200: Successful operation
            404: User not found
        """

        try:
            user = await get_data_from_req(self.request).administrators.get_user(
                user_id
            )
        except ResourceNotFoundError:
            raise NotFound()

        return json_response(user)

    @policy(AdministratorRoutePolicy(AdministratorRole.USERS))
    async def patch(
        self, user_id: str, /, data: UpdateUserRequest
    ) -> Union[r200[UserResponse], r404]:
        """
        Update a user

        Status Codes:
            200: Successful operation
            404: User not found
        """

        if not await can_edit_user(
            get_authorization_client_from_req(self.request),
            self.request["client"].user_id,
            user_id,
        ):
            raise HTTPForbidden(text="Insufficient privileges")

        try:
            user = await get_data_from_req(self.request).administrators.update_user(
                user_id, data
            )
        except ResourceNotFoundError:
            raise NotFound()

        return json_response(user)


async def can_edit_user(authorization_client, req_user_id, user_id):
    admin_tuple, req_admin_tuple = await asyncio.gather(
        authorization_client.get_administrator(user_id),
        authorization_client.get_administrator(req_user_id),
    )

    if admin_tuple[1] == None:
        return True

    if req_admin_tuple[1] == AdministratorRole.FULL:
        return True

    return False


@routes.view("/admin/users/{user_id}/role")
class AdministratorsView(PydanticView):
    @policy(AdministratorRoutePolicy(AdministratorRole.FULL))
    async def post(
        self, user_id: str, /, data: UpdateAdministratorRoleRequest
    ) -> Union[r201[UserResponse], r404]:
        """
        Change a users administrator role

        Status Codes:
            201: Successful operation
            404: User not found
        """

        if user_id == self.request["client"].user_id:
            raise HTTPBadRequest(text="Cannot change own role")

        try:
            administrator = await get_data_from_req(
                self.request
            ).administrators.update_role(user_id, data)
        except ResourceNotFoundError:
            raise NotFound()

        return json_response(administrator, status=201)
