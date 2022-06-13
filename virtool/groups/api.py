from typing import List, Union

from aiohttp.web_exceptions import HTTPBadRequest, HTTPNoContent
from aiohttp_pydantic import PydanticView
from aiohttp_pydantic.oas.typing import r200, r201, r204, r404, r400
from virtool_core.models import Group

from virtool.api.response import NotFound, json_response
from virtool.data.errors import ResourceNotFoundError, ResourceConflictError
from virtool.data.utils import get_data_from_req
from virtool.groups.oas import CreateGroupSchema, EditGroupSchema
from virtool.http.privileges import admin
from virtool.http.routes import Routes

routes = Routes()


@routes.view("/groups")
class GroupsView(PydanticView):
    async def get(self) -> r200[List[Group]]:
        """
        List all existing user groups.

        Status Codes:
            200: Successful operation
        """
        return json_response(
            [
                Group.parse_obj(group).dict()
                for group in await get_data_from_req(self.request).groups.find()
            ]
        )

    @admin
    async def post(self, data: CreateGroupSchema) -> Union[r201[Group], r400]:
        """
        Create a new group.

        New groups have no permissions.

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
            Group.parse_obj(group).dict(),
            status=201,
            headers={"Location": f"/groups/{group.id}"},
        )


@routes.view("/groups/{group_id}")
class GroupView(PydanticView):
    async def get(self) -> Union[r200[Group], r404]:
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

        return json_response(Group.parse_obj(group).dict())

    @admin
    async def patch(self, data: EditGroupSchema) -> Union[r200[Group], r404]:
        """
        Update the permissions of a group.

        Unset permissions will retain their previous setting.

        Status Codes:
            200: Successful operation
            404: Group not found
        """
        group_id = self.request.match_info["group_id"]

        try:
            group = await get_data_from_req(self.request).groups.update(
                group_id, data.permissions.dict(exclude_unset=True)
            )
        except ResourceNotFoundError:
            raise NotFound()

        return json_response(Group.parse_obj(group).dict())

    @admin
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
