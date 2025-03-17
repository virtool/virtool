from pydantic import Field
from virtool_core.models.group import GroupMinimal, GroupSearchResult
from virtool_core.models.roles import AdministratorRole

from virtool.api.custom_json import json_response
from virtool.api.errors import APIBadRequest, APINoContent, APINotFound
from virtool.api.policy import AdministratorRoutePolicy, policy
from virtool.api.routes import Routes
from virtool.api.status import R200, R201, R204, R400, R404
from virtool.api.view import APIView
from virtool.data.errors import ResourceConflictError, ResourceNotFoundError
from virtool.groups.oas import (
    GroupCreateRequest,
    GroupCreateResponse,
    GroupResponse,
    GroupUpdateRequest,
)

routes = Routes()


@routes.web.view("/groups")
class GroupsView(APIView):
    async def get(
        self,
        page: int = Field(default=1, ge=1),
        per_page: int = Field(default=25, ge=1, le=100),
        paginate: bool = Field(default=False),
        term: str | None = None,
    ) -> R200[list[GroupMinimal] | GroupSearchResult]:
        """List groups.

        Lists all user groups. The group IDs and names are included in the response.

        Status Codes:
            200: Successful operation
        """
        if paginate:
            result = await self.data.groups.find(page, per_page, term)
        else:
            result = await self.data.groups.list()

        return json_response(result)

    @policy(AdministratorRoutePolicy(AdministratorRole.BASE))
    async def post(self, data: GroupCreateRequest) -> R201[GroupCreateResponse] | R400:
        """Create a group.

        Creates a new group with the given name.

        The ``group_id`` parameter is deprecated and will no longer be accepted in a
        future major release. For now, ``group_id`` will be used as ``name`` if it is
        provided.

        Status Codes:
            201: Successful operation
            400: Group already exists
        """
        name = data.name

        try:
            group = await self.data.groups.create(name)
        except ResourceConflictError:
            raise APIBadRequest("Group already exists")

        return json_response(
            GroupResponse.parse_obj(group),
            status=201,
            headers={"Location": f"/groups/{group.id}"},
        )


@routes.web.view("/groups/{group_id}")
class GroupView(APIView):
    async def get(self, group_id: int, /) -> R200[GroupResponse] | R404:
        """Get a group.

        Fetches the complete representation of a single user group including its
        permissions.

        Status Codes:
            200: Successful operation
            404: Group not found
        """
        try:
            group = await self.data.groups.get(group_id)
        except ResourceNotFoundError:
            raise APINotFound()

        return json_response(GroupResponse.parse_obj(group))

    @policy(AdministratorRoutePolicy(AdministratorRole.BASE))
    async def patch(
        self,
        group_id: int,
        /,
        data: GroupUpdateRequest,
    ) -> R200[GroupResponse] | R404:
        """Update a group.

        Updates a group's name or permissions.

        Permissions that are not included in the ``permissions`` object will retain
        their previous setting.

        Status Codes:
            200: Successful operation
            404: Group not found
        """
        try:
            group = await self.data.groups.update(group_id, data)
        except ResourceNotFoundError:
            raise APINotFound()

        return json_response(GroupResponse.parse_obj(group))

    @policy(AdministratorRoutePolicy(AdministratorRole.BASE))
    async def delete(self, group_id: int, /) -> R204 | R404:
        """Delete a group.

        Deletes a group by its 'group id'.

        Status Codes:
            204: No content
            404: Group not found

        """
        try:
            await self.data.groups.delete(group_id)
        except ResourceNotFoundError:
            raise APINotFound()

        raise APINoContent()
