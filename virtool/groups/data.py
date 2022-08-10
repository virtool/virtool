from typing import List, Dict

from pymongo.errors import DuplicateKeyError

from virtool.data.errors import ResourceNotFoundError, ResourceConflictError
from virtool.groups.db import update_member_users, fetch_group_users
from virtool.mongo.core import DB
from virtool.mongo.utils import get_one_field
from virtool.users.utils import generate_base_permissions
from virtool.utils import base_processor
from virtool_core.models.group import GroupMinimal, Group


class GroupsData:
    def __init__(self, db):
        self._db: DB = db

    async def find(self) -> List[GroupMinimal]:
        """
        List all user groups.

        :returns: a list of all user groups

        """
        return [
            GroupMinimal(**base_processor(document))
            async for document in self._db.groups.find()
        ]

    async def get(self, group_id: str) -> Group:
        """
        Get a single group by its ID.

        :param group_id: the group's ID
        :return: the group
        """
        document = await self._db.groups.find_one(group_id)

        if document is None:
            raise ResourceNotFoundError()

        return Group(
            **base_processor(document),
            users=await fetch_group_users(self._db, group_id)
        )

    async def create(self, group_id: str) -> Group:
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

        return Group(**base_processor(document), users=[])

    async def update(self, group_id: str, permissions_update: Dict[str, str]) -> Group:
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

        return Group(
            **base_processor(document),
            users=await fetch_group_users(self._db, group_id)
        )

    async def delete(self, group_id: str):
        async with self._db.create_session() as session:
            delete_result = await self._db.groups.delete_one(
                {"_id": group_id}, session=session
            )

            if not delete_result.deleted_count:
                raise ResourceNotFoundError

            await update_member_users(self._db, group_id, remove=True, session=session)
