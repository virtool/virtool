from typing import List, Union

import pymongo.errors
from aiohttp.web_exceptions import HTTPBadRequest, HTTPNoContent
from aiohttp_pydantic import PydanticView
from aiohttp_pydantic.oas.typing import r200, r201, r204, r404, r400

import virtool.groups.db
import virtool.http.routes
from virtool.api.response import NotFound, json_response
from virtool.users.utils import generate_base_permissions
from virtool.utils import base_processor
from virtool.data_model.group import VirtoolGroup
from virtool.groups.oas import CreateGroupSchema, EditGroupSchema
from virtool.http.privileges import admin

routes = virtool.http.routes.Routes()


@routes.view("/groups")
class Groups(PydanticView):

    async def get(self) -> r200[List[VirtoolGroup]]:
        """
        List all existing user groups.

        Status Codes:
            200: Successful operation
        """
        cursor = self.request.app["db"].groups.find()
        return json_response([base_processor(d) async for d in cursor])

    @admin
    async def post(self, data: CreateGroupSchema) -> Union[r201[VirtoolGroup], r400]:
        """
        Create a new group.

        New groups have no permissions.

        Status Codes:
            201: Successful operation
            400: Group already exists
        """
        db = self.request.app["db"]
        group_id = data.group_id

        document = {
            "_id": group_id,
            "permissions": generate_base_permissions(),
        }

        try:
            await db.groups.insert_one(document)
        except pymongo.errors.DuplicateKeyError:
            raise HTTPBadRequest(text="Group already exists")

        headers = {"Location": "/groups/" + group_id}

        return json_response(base_processor(document), status=201, headers=headers)


@routes.view("/groups/{group_id}")
class Group(PydanticView):

    async def get(self) -> Union[r200[VirtoolGroup], r404]:
        """
        Get the complete representation of a single user group.

        Status Codes:
            200: Successful operation
            404: Group not found
        """
        document = await self.request.app["db"].groups.find_one(
            self.request.match_info["group_id"]
        )

        if document:
            return json_response(base_processor(document))

        raise NotFound()

    @admin
    async def patch(self, data: EditGroupSchema) -> Union[r200[VirtoolGroup], r404]:
        """
        Update the permissions of a group.

        Unset permissions will retain their previous setting.

        Status Codes:
            200: Successful operation
            404: Group not found
        """
        db = self.request.app["db"]
        permissions = data.permissions.dict(exclude_unset=True)

        group_id = self.request.match_info["group_id"]

        old_document = await db.groups.find_one({"_id": group_id}, ["permissions"])

        if not old_document:
            raise NotFound()

        old_document["permissions"].update(permissions)

        # Get the current permissions dict for the passed group id.
        document = await db.groups.find_one_and_update(
            {"_id": group_id}, {"$set": {"permissions": old_document["permissions"]}}
        )

        await virtool.groups.db.update_member_users(db, group_id)

        return json_response(base_processor(document))

    @admin
    async def delete(self) -> Union[r204, r404]:
        """
        Delete a group.

        Status Codes:
            204: No content
            404: Group not found

        """
        db = self.request.app["db"]

        group_id = self.request.match_info["group_id"]

        delete_result = await db.groups.delete_one({"_id": group_id})

        if not delete_result.deleted_count:
            raise NotFound()

        await virtool.groups.db.update_member_users(db, group_id, remove=True)

        raise HTTPNoContent
