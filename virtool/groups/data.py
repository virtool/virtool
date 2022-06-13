from typing import List, Dict

from pymongo.errors import DuplicateKeyError

from virtool.data.errors import ResourceNotFoundError, ResourceConflictError
from virtool.data_model.group import VTGroup
from virtool.groups.db import update_member_users
from virtool.mongo.core import DB
from virtool.mongo.utils import get_one_field
from virtool.users.utils import generate_base_permissions
from virtool.utils import base_processor


class GroupsData:
    def __init__(self, db):
        self._db: DB = db

    async def find(self) -> List[VTGroup]:
        """
        List all user groups.

        :returns: a list of all user groups

        """
        return [
            VTGroup(**base_processor(document))
            async for document in self._db.groups.find()
        ]

    async def get(self, group_id: str) -> VTGroup:
        """
        Get a single group by its ID.

        :param group_id: the group's ID
        :return: the group
        """
        document = await self._db.groups.find_one(group_id)

        if document is None:
            raise ResourceNotFoundError()

        return VTGroup(**base_processor(document))

    async def create(self, group_id: str) -> VTGroup:
        """
        Create new group given a group ID.

        :param group_id: the ID for the new group
        :return: the group
        """
        try:
            document = await self._db.groups.insert_one(
                {
                    "_id": group_id,
                    "permissions": generate_base_permissions(),
                }
            )
        except DuplicateKeyError:
            raise ResourceConflictError("Group already exists")

        return VTGroup(**base_processor(document))

    async def update(
        self, group_id: str, permissions_update: Dict[str, str]
    ) -> VTGroup:
        """
        Update the permissions for a group.

        :param group_id: the ID of the group to update
        :param permissions_update: the update to merge into the current permissions
        :return: the group
        """
        permissions = await get_one_field(
            self._db.groups, "permissions", {"_id": group_id}
        )

        if not permissions:
            raise ResourceNotFoundError

        async with self._db.create_session() as session:
            document = await self._db.groups.find_one_and_update(
                {"_id": group_id},
                {"$set": {"permissions": {**permissions, **permissions_update}}},
                session=session,
            )

            await update_member_users(self._db, group_id, session=session)

        return VTGroup(**base_processor(document))

    async def delete(self, group_id: str):
        async with self._db.create_session() as session:
            delete_result = await self._db.groups.delete_one(
                {"_id": group_id}, session=session
            )

            if not delete_result.deleted_count:
                raise ResourceNotFoundError

            await update_member_users(self._db, group_id, remove=True, session=session)
