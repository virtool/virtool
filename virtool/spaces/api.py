from aiohttp_pydantic import PydanticView
from aiohttp_pydantic.oas.typing import r201, r200, r204, r404
from virtool_core.models.roles import AdministratorRole

from virtool.api.errors import APINotFound, APIBadRequest, APINoContent
from virtool.api.policy import policy, AdministratorRoutePolicy
from virtool.api.custom_json import json_response
from virtool.api.routes import Routes
from virtool.data.errors import ResourceNotFoundError, ResourceConflictError
from virtool.data.utils import get_data_from_req
from virtool.flags import flag, FlagName
from virtool.spaces.oas import (
    UpdateSpaceRequest,
    UpdateMemberRequest,
    ListSpacesResponse,
    GetSpaceResponse,
    UpdateSpaceResponse,
    ListMembersResponse,
    UpdateMemberResponse,
)

routes = Routes()


@flag(FlagName.SPACES)
@routes.view("/spaces")
class SpacesView(PydanticView):
    async def get(self) -> r200[ListSpacesResponse]:
        """
        List spaces.

        Get a list of all spaces that the requesting user is a member or owner of.

        Status Codes:
            200: Successful operation
        """

        return json_response(
            await get_data_from_req(self.request).spaces.find(
                self.request["client"].user_id
            )
        )


@flag(FlagName.SPACES)
@routes.view("/spaces/{space_id}")
class SpaceView(PydanticView):
    async def get(self, space_id: int, /) -> r200[GetSpaceResponse] | r404:
        """
        Get a space.

        Fetches the complete representation of a space.

        Status Codes:
            200: Successful operation
            404: User not found
        """

        try:
            space = await get_data_from_req(self.request).spaces.get(space_id)
        except ResourceNotFoundError:
            raise APINotFound()

        return json_response(space)

    @policy(AdministratorRoutePolicy(AdministratorRole.SPACES))
    async def patch(
        self, space_id: int, /, data: UpdateSpaceRequest
    ) -> r201[UpdateSpaceResponse] | r404:
        """
        Update a space.

        Changes the name or description of a space.

        Status Codes:
            200: Successful operation
            400: Invalid input
            404: User not found
        """
        try:
            space = await get_data_from_req(self.request).spaces.update(space_id, data)
        except ResourceNotFoundError:
            raise APINotFound()
        except ResourceConflictError:
            raise APIBadRequest("Space name already exists.")

        return json_response(space)


@flag(FlagName.SPACES)
@routes.view("/spaces/{space_id}/members")
class SpaceMembersView(PydanticView):
    async def get(self, space_id: int, /) -> r200[ListMembersResponse]:
        """
        List members.

        Lists the members of a space and their roles.

        Status Codes:
            200: Successful operation
        """
        try:
            members = await get_data_from_req(self.request).spaces.find_members(
                space_id
            )
        except ResourceNotFoundError:
            raise APINotFound()

        return json_response(members)


@flag(FlagName.SPACES)
@routes.view("/spaces/{space_id}/members/{member_id}")
class SpaceMemberView(PydanticView):
    @policy(AdministratorRoutePolicy(AdministratorRole.SPACES))
    async def patch(
        self, space_id: int, member_id: int | str, /, data: UpdateMemberRequest
    ) -> r200[UpdateMemberResponse] | r404:
        """
        Update a member.

        Changes the roles of the space member.

        Status Codes:
            200: Successful operation
            404: User not found
        """
        try:
            member = await get_data_from_req(self.request).spaces.update_member(
                space_id, member_id, data
            )
        except ResourceNotFoundError:
            raise APINotFound()

        return json_response(member)

    @policy(AdministratorRoutePolicy(AdministratorRole.SPACES))
    async def delete(self, space_id: int, member_id: int | str, /) -> r204 | r404:
        """
        Remove a member.

        Removes a member from the space.
        They will no longer have access to any data in the space.

        Status Codes:
            204: Successful operation
            404: User not found
        """
        try:
            await get_data_from_req(self.request).spaces.remove_member(
                space_id, member_id
            )
        except ResourceNotFoundError:
            raise APINotFound()

        raise APINoContent()
