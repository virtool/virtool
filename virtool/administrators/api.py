from typing import Union

from aiohttp.web_exceptions import HTTPNoContent, HTTPBadRequest
from aiohttp_pydantic import PydanticView
from aiohttp_pydantic.oas.typing import r201, r200, r204, r404

from virtool_core.models.roles import AdministratorRole

from virtool.administrators.oas import (
    CreateAdministratorRequest,
    UpdateAdministratorRequest,
    ListAdministratorResponse,
    GetAdministratorResponse,
    CreateAdministratorResponse,
    UpdateAdministratorResponse,
)
from virtool.api.response import NotFound, json_response
from virtool.data.errors import ResourceNotFoundError
from virtool.data.utils import get_data_from_req
from virtool.http.policy import policy, AdministratorRoutePolicy
from virtool.http.routes import Routes

routes = Routes()


@routes.view("/administrators")
class AdministratorsView(PydanticView):
    @policy(AdministratorRoutePolicy(AdministratorRole.FULL))
    async def get(self) -> r200[ListAdministratorResponse]:
        """
        List administrators.

        Lists all administrators.

        Status Codes:
            200: Successful operation
        """
        return json_response(
            await get_data_from_req(self.request).administrators.find()
        )

    @policy(AdministratorRoutePolicy(AdministratorRole.FULL))
    async def post(
        self, data: CreateAdministratorRequest
    ) -> Union[r201[CreateAdministratorResponse], r404]:
        """
        Add an administrator.

        Adds a user as an administrator using their user id.

        Status Codes:
            201: Successful operation
            400: User not found
        """

        try:
            administrator = await get_data_from_req(self.request).administrators.create(
                data
            )
        except ResourceNotFoundError as err:
            if "User not found" in str(err):
                raise HTTPBadRequest(text=str(err))

        return json_response(administrator, status=201)


@routes.view("/administrators/{user_id}")
class AdministratorView(PydanticView):
    @policy(AdministratorRoutePolicy(AdministratorRole.FULL))
    async def get(self, user_id: str, /) -> Union[r200[GetAdministratorResponse], r404]:
        """
        Get an administrator.

        Fetches the complete representation of an administrator.

        Status Codes:
            200: Successful operation
            404: User not found
        """

        try:
            administrator = await get_data_from_req(self.request).administrators.get(
                user_id
            )
        except ResourceNotFoundError:
            raise NotFound()

        return json_response(administrator)

    @policy(AdministratorRoutePolicy(AdministratorRole.FULL))
    async def patch(
        self, user_id: str, /, data: UpdateAdministratorRequest
    ) -> Union[r201[UpdateAdministratorResponse], r404]:
        """
        Update administrator's role.

        Updates administrator data for a specified user.

        Administrators cannot modify their own role.

        Status Codes:
            200: Successful operation
            400: Cannot modify own role
            404: User not found
        """
        if user_id == self.request["client"].user_id:
            raise HTTPBadRequest(text="Administrators cannot modify their own role.")

        try:
            administrator = await get_data_from_req(self.request).administrators.update(
                user_id, data
            )
        except ResourceNotFoundError:
            raise NotFound()

        return json_response(administrator)

    @policy(AdministratorRoutePolicy(AdministratorRole.FULL))
    async def delete(self, user_id: str, /) -> Union[r204, r404]:
        """
        Remove an administrator.

        Removes a user as an administrator.

        Status Codes:
            204: Successful operation
            404: User not found
        """

        if user_id == self.request["client"].user_id:
            raise HTTPBadRequest(
                text="Users cannot modify their own administrative status"
            )

        try:
            await get_data_from_req(self.request).administrators.delete(user_id)
        except ResourceNotFoundError:
            raise NotFound()

        raise HTTPNoContent
