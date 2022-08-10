from typing import List, Union

from aiohttp.web_exceptions import HTTPBadRequest, HTTPNoContent
from aiohttp_pydantic import PydanticView
from aiohttp_pydantic.oas.typing import r201, r200, r204, r404, r400


from virtool.api.response import NotFound, json_response
from virtool.data.errors import ResourceNotFoundError, ResourceConflictError
from virtool.data.utils import get_data_from_req
from virtool.groups.oas import (
    CreateGroupSchema,
    EditGroupSchema,
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

    @policy(AdministratorRoutePolicy)
    async def post(
        self, data: CreateGroupSchema
    ) -> Union[r201[CreateGroupResponse], r400]:
        """
        Create a new group. New groups have no permissions.

        Status Codes:
            201: Successful operation
            400: Group already exists
        """
        group_id = data.group_id

        try:
            group = await get_data_from_req(self.request).groups.create(group_id)
        except ResourceConflictError:
            raise HTTPBadRequest(text="Group already exists")

        return json_response(
            GroupResponse.parse_obj(group).dict(),
            status=201,
            headers={"Location": f"/groups/{group.id}"},
        )


@routes.view("/groups/{group_id}")
class GroupView(PydanticView):
    async def get(self) -> Union[r200[GroupResponse], r404]:
        """
        Get the complete representation of a single user group.

        Status Codes:
            200: Successful operation
            404: Group not found
        """
        group_id = self.request.match_info["group_id"]

        try:
            group = await get_data_from_req(self.request).groups.get(group_id)
        except ResourceNotFoundError:
            raise NotFound()

        return json_response(GroupResponse.parse_obj(group).dict())

    @policy(AdministratorRoutePolicy)
    async def patch(self, data: EditGroupSchema) -> Union[r200[GroupResponse], r404]:
        """
        Update the permissions of a group.

        Permissions that are not included in the ``permissions`` object will retain
        their previous setting.

        Status Codes:
            200: Successful operation
            404: Group not found
        """
        group_id = self.request.match_info["group_id"]

        try:
            group = await get_data_from_req(self.request).groups.update(group_id, data)
        except ResourceNotFoundError:
            raise NotFound()

        return json_response(GroupResponse.parse_obj(group).dict())

    @policy(AdministratorRoutePolicy)
    async def delete(self) -> Union[r204, r404]:
        """
        Delete a group.

        Status Codes:
            204: No content
            404: Group not found

        """
        group_id = self.request.match_info["group_id"]

        try:
            await get_data_from_req(self.request).groups.delete(group_id)
        except ResourceNotFoundError:
            raise NotFound()

        raise HTTPNoContent
