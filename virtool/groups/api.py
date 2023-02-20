from typing import List, Union

from aiohttp.web_exceptions import HTTPBadRequest, HTTPNoContent
from aiohttp_pydantic import PydanticView
from aiohttp_pydantic.oas.typing import r201, r200, r204, r404, r400


from virtool.api.response import NotFound, json_response
from virtool_core.models.roles import AdministratorRole
from virtool.data.errors import ResourceNotFoundError, ResourceConflictError
from virtool.data.utils import get_data_from_req
from virtool.groups.oas import (
    CreateGroupRequest,
    UpdateGroupRequest,
    CreateGroupResponse,
    GroupResponse,
    GetGroupResponse,
)
from virtool.http.policy import policy, AdministratorRoutePolicy
from virtool.http.routes import Routes

routes = Routes()


@routes.view("/groups")
class GroupsView(PydanticView):
    async def get(self) -> r200[List[GetGroupResponse]]:
        """
        List all existing user groups.

        Status Codes:
            200: Successful operation
        """
        return json_response(
            [
                GetGroupResponse.parse_obj(group).dict()
                for group in await get_data_from_req(self.request).groups.find()
            ]
        )

    @policy(AdministratorRoutePolicy(AdministratorRole.BASE))
    async def post(
        self, data: CreateGroupRequest
    ) -> Union[r201[CreateGroupResponse], r400]:
        """
        Create a group.

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
            group = await get_data_from_req(self.request).groups.create(name)
        except ResourceConflictError:
            raise HTTPBadRequest(text="Group already exists")

        return json_response(
            GroupResponse.parse_obj(group),
            status=201,
            headers={"Location": f"/groups/{group.id}"},
        )


@routes.view("/groups/{group_id}")
class GroupView(PydanticView):
    async def get(self, group_id: str, /) -> Union[r200[GroupResponse], r404]:
        """
        Get the complete representation of a single user group.

        Status Codes:
            200: Successful operation
            404: Group not found
        """
        try:
            group = await get_data_from_req(self.request).groups.get(group_id)
        except ResourceNotFoundError:
            raise NotFound()

        return json_response(GroupResponse.parse_obj(group))

    @policy(AdministratorRoutePolicy(AdministratorRole.BASE))
    async def patch(
        self, group_id: str, /, data: UpdateGroupRequest
    ) -> Union[r200[GroupResponse], r404]:
        """
        Update a group.

        Updates a group's name or permissions.

        Permissions that are not included in the ``permissions`` object will retain
        their previous setting.

        Status Codes:
            200: Successful operation
            404: Group not found
        """
        try:
            group = await get_data_from_req(self.request).groups.update(group_id, data)
        except ResourceNotFoundError:
            raise NotFound()

        return json_response(GroupResponse.parse_obj(group))

    @policy(AdministratorRoutePolicy(AdministratorRole.BASE))
    async def delete(self, group_id: str, /) -> Union[r204, r404]:
        """
        Delete a group.

        Status Codes:
            204: No content
            404: Group not found

        """
        try:
            await get_data_from_req(self.request).groups.delete(group_id)
        except ResourceNotFoundError:
            raise NotFound()

        raise HTTPNoContent
