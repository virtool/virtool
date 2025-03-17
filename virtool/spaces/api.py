from virtool_core.models.roles import AdministratorRole

from virtool.api.custom_json import json_response
from virtool.api.errors import APIBadRequest, APINoContent, APINotFound
from virtool.api.policy import AdministratorRoutePolicy, policy
from virtool.api.routes import Routes
from virtool.api.status import R200, R201, R204, R404
from virtool.api.view import APIView
from virtool.data.errors import ResourceConflictError, ResourceNotFoundError
from virtool.flags import FlagName, flag
from virtool.spaces.oas import (
    SpaceListMembersResponse,
    SpaceMemberUpdateRequest,
    SpaceResponse,
    SpacesListResponse,
    SpaceUpdateRequest,
    SpaceUpdateResponse,
    UpdateMemberResponse,
)

routes = Routes()


@flag(FlagName.SPACES)
@routes.web.view("/spaces")
class SpacesView(APIView):
    async def get(self) -> R200[SpacesListResponse]:
        """List spaces.

        Get a list of all spaces that the requesting user is a member or owner of.

        Status Codes:
            200: Successful operation
        """
        return json_response(
            await self.data.spaces.find(
                self.request["client"].user_id,
            ),
        )


@flag(FlagName.SPACES)
@routes.web.view("/spaces/{space_id}")
class SpaceView(APIView):
    async def get(self, space_id: int, /) -> R200[SpaceResponse] | R404:
        """Get a space.

        Fetches the complete representation of a space.

        Status Codes:
            200: Successful operation
            404: User not found
        """
        try:
            space = await self.data.spaces.get(space_id)
        except ResourceNotFoundError:
            raise APINotFound()

        return json_response(space)

    @policy(AdministratorRoutePolicy(AdministratorRole.SPACES))
    async def patch(
        self,
        space_id: int,
        /,
        data: SpaceUpdateRequest,
    ) -> R201[SpaceUpdateResponse] | R404:
        """Update a space.

        Changes the name or description of a space.

        Status Codes:
            200: Successful operation
            400: Invalid input
            404: User not found
        """
        try:
            space = await self.data.spaces.update(space_id, data)
        except ResourceNotFoundError:
            raise APINotFound()
        except ResourceConflictError:
            raise APIBadRequest("Space name already exists.")

        return json_response(space)


@flag(FlagName.SPACES)
@routes.web.view("/spaces/{space_id}/members")
class SpaceMembersView(APIView):
    async def get(self, space_id: int, /) -> R200[SpaceListMembersResponse]:
        """List members.

        Lists the members of a space and their roles.

        Status Codes:
            200: Successful operation
        """
        try:
            members = await self.data.spaces.find_members(
                space_id,
            )
        except ResourceNotFoundError:
            raise APINotFound()

        return json_response(members)


@flag(FlagName.SPACES)
@routes.web.view("/spaces/{space_id}/members/{member_id}")
class SpaceMemberView(APIView):
    @policy(AdministratorRoutePolicy(AdministratorRole.SPACES))
    async def patch(
        self,
        space_id: int,
        member_id: int | str,
        /,
        data: SpaceMemberUpdateRequest,
    ) -> R200[UpdateMemberResponse] | R404:
        """Update a member.

        Changes the roles of the space member.

        Status Codes:
            200: Successful operation
            404: User not found
        """
        try:
            member = await self.data.spaces.update_member(
                space_id,
                member_id,
                data,
            )
        except ResourceNotFoundError:
            raise APINotFound()

        return json_response(member)

    @policy(AdministratorRoutePolicy(AdministratorRole.SPACES))
    async def delete(self, space_id: int, member_id: int | str, /) -> R204 | R404:
        """Remove a member.

        Removes a member from the space.
        They will no longer have access to any data in the space.

        Status Codes:
            204: Successful operation
            404: User not found
        """
        try:
            await self.data.spaces.remove_member(
                space_id,
                member_id,
            )
        except ResourceNotFoundError:
            raise APINotFound()

        raise APINoContent()
