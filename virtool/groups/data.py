from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from virtool_core.models.group import GroupMinimal, Group
from virtool_core.models.user import UserNested

from virtool.authorization.client import AuthorizationClient
from virtool.data.errors import ResourceNotFoundError, ResourceConflictError
from virtool.data.events import emits, Operation, emit
from virtool.data.topg import both_transactions
from virtool.groups.mongo import (
    update_member_users_and_api_keys,
)
from virtool.groups.oas import UpdateGroupRequest
from virtool.groups.pg import SQLGroup
from virtool.mongo.core import Mongo
from virtool.users.pg import user_group_associations
from virtool.users.utils import generate_base_permissions
from virtool.utils import base_processor


class GroupsData:
    name = "groups"

    def __init__(
        self, authorization_client: AuthorizationClient, mongo: Mongo, pg: AsyncEngine
    ):
        self._authorization_client = authorization_client
        self._mongo = mongo
        self._pg = pg

    async def find(self) -> list[GroupMinimal]:
        """
        List all user groups.

        :return: a list of all user groups

        """
        async with AsyncSession(self._pg) as session:
            result = await session.execute(select(SQLGroup))
            return [GroupMinimal(**group.to_dict()) for group in result.scalars()]

    async def get(self, group_id: int) -> Group:
        """
        Get a single group by its ID.

        :param group_id: the group's ID
        :return: the group
        """

        async with AsyncSession(self._pg) as session:
            group: SQLGroup | None = await session.get(SQLGroup, group_id)

            if group:
                users = [
                    UserNested(**base_processor(user))
                    async for user in self._mongo.users.find({"groups": group_id})
                ]

                return Group(
                    **{
                        **group.to_dict(),
                        "users": users,
                    }
                )

        raise ResourceNotFoundError

    @emits(Operation.CREATE)
    async def create(self, name: str) -> Group:
        """
        Create new group with the given name.

        :param name: the id for the new group
        :return: the group
        :raises ResourceConflictError: if a group with the given name already exists
        """
        try:
            async with AsyncSession(self._pg) as session:
                group = SQLGroup(
                    legacy_id=None,
                    name=name,
                    permissions=generate_base_permissions(),
                )

                session.add(group)

                await session.flush()

                group_id = group.id

                await session.commit()
        except IntegrityError:
            raise ResourceConflictError("Group already exists")

        return await self.get(group_id)

    @emits(Operation.UPDATE)
    async def update(self, group_id: int, data: UpdateGroupRequest) -> Group:
        """
        Update the name or permissions for a group.

        :param group_id: the id of the group
        :param data: updates to the current group permissions or name
        :return: the updated group
        :raises ResourceNotFoundError: if the group does not exist

        """

        async with both_transactions(self._mongo, self._pg) as (
            mongo_session,
            pg_session,
        ):
            group = await pg_session.get(SQLGroup, group_id)

            if not group:
                raise ResourceNotFoundError

            data = data.dict(exclude_unset=True)

            db_update = {}

            if "name" in data:
                group.name = data["name"]

            if "permissions" in data:
                group.permissions = {**group.permissions, **data["permissions"]}

            if db_update:
                group.update(db_update)
                await update_member_users_and_api_keys(
                    self._mongo, mongo_session, pg_session, group.id
                )

        return await self.get(group_id)

    async def delete(self, group_id: int):
        """
        Delete a group by its id.

        Deletes the group and updates all member user permissions if they are affected
        by deletion of the group.

        :param group_id: the id of the group to delete
        :raises ResourceNotFoundError: if the group is not found

        """
        group = await self.get(group_id)

        async with both_transactions(self._mongo, self._pg) as (
            mongo_session,
            pg_session,
        ):
            # Check if the group is associated with any users
            user_associations = await pg_session.execute(
                select(user_group_associations).where(
                    user_group_associations.c.group_id == group_id
                )
            )

            if user_associations:
                # If the group is associated with any users, remove the associations
                await pg_session.execute(
                    delete(user_group_associations).where(
                        user_group_associations.c.group_id == group_id
                    )
                )
            result = await pg_session.execute(
                delete(SQLGroup).where(SQLGroup.id == group_id)
            )

            if not result.rowcount:
                raise ResourceNotFoundError

            await update_member_users_and_api_keys(
                self._mongo, mongo_session, pg_session, group_id
            )

        emit(group, "groups", "delete", Operation.DELETE)
