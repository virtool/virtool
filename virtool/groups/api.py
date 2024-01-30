from typing import Optional

from aiohttp_pydantic import PydanticView
from aiohttp_pydantic.oas.typing import r201, r200, r204, r404, r400
from virtool_core.models.roles import AdministratorRole

from virtool.api.errors import APINotFound, APIBadRequest, APINoContent
from virtool.api.custom_json import json_response
from virtool.data.errors import ResourceNotFoundError, ResourceConflictError
from virtool.data.utils import get_data_from_req
from virtool.groups.oas import (
    CreateGroupRequest,
    UpdateGroupRequest,
    CreateGroupResponse,
    GroupResponse,
    GetGroupResponse,
)
from virtool.api.policy import policy, AdministratorRoutePolicy
from virtool.api.routes import Routes

from pydantic import conint

routes = Routes()


@routes.view("/groups")
class GroupsView(PydanticView):
    async def get(
            self,
            user: Optional[str] = None,
            page: conint(ge=1) = 1,
            per_page: conint(ge=1, le=100) = 25,
            paginate: Optional[bool] = False,
    ) -> r200[list[GetGroupResponse]]:
        """
        List groups.

        Lists all user groups. The group IDs and names are included in the response.

        Status Codes:
            200: Successful operation
        """

        groups = await get_data_from_req(self.request).groups.find(
            user,
                                                                   page, per_page, paginate
                                                                   )

        if paginate:
            return json_response(
                {
                    "items": [
                        GetGroupResponse.parse_obj(group).dict() for group in groups
                    ]
                }
            )

        return json_response(
            [GetGroupResponse.parse_obj(group).dict() for group in groups]
        )

    @policy(AdministratorRoutePolicy(AdministratorRole.BASE))
    async def post(self, data: CreateGroupRequest) -> r201[CreateGroupResponse] | r400:
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
            raise APIBadRequest("Group already exists")

        return json_response(
            GroupResponse.parse_obj(group),
            status=201,
            headers={"Location": f"/groups/{group.id}"},
        )


@routes.view("/groups/{group_id}")
class GroupView(PydanticView):
    async def get(self, group_id: int, /) -> r200[GroupResponse] | r404:
        """
        Get a group.

        Fetches the complete representation of a single user group including its
        permissions.

        Status Codes:
            200: Successful operation
            404: Group not found
        """
        try:
            group = await get_data_from_req(self.request).groups.get(group_id)
        except ResourceNotFoundError:
            raise APINotFound()

        return json_response(GroupResponse.parse_obj(group))

    @policy(AdministratorRoutePolicy(AdministratorRole.BASE))
    async def patch(
            self, group_id: int, /, data: UpdateGroupRequest
    ) -> r200[GroupResponse] | r404:
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
            raise APINotFound()

        return json_response(GroupResponse.parse_obj(group))

    @policy(AdministratorRoutePolicy(AdministratorRole.BASE))
    async def delete(self, group_id: int, /) -> r204 | r404:
        """
        Delete a group.

        Deletes a group by its 'group id'.

        Status Codes:
            204: No content
            404: Group not found

        """
        try:
            await get_data_from_req(self.request).groups.delete(group_id)
        except ResourceNotFoundError:
            raise APINotFound()

        raise APINoContent()
