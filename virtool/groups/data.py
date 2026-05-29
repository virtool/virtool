from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.data.errors import ResourceConflictError, ResourceNotFoundError
from virtool.data.events import Operation, emit, emits
from virtool.data.topg import both_transactions
from virtool.groups.models import Group
from virtool.groups.oas import UpdateGroupRequest
from virtool.groups.pg import SQLGroup
from virtool.mongo.core import Mongo
from virtool.users.models_base import UserNested
from virtool.users.pg import SQLUser, SQLUserGroup
from virtool.users.utils import generate_base_permissions


class GroupsData:
    name = "groups"

    def __init__(
        self,
        mongo: Mongo,
        pg: AsyncEngine,
    ):
        self._mongo = mongo
        self._pg = pg

    async def get(self, group_id: int) -> Group:
        """Get a single group by its ID.

        :param group_id: the group's ID
        :return: the group
        """
        async with AsyncSession(self._pg) as session:
            group: SQLGroup | None = await session.get(SQLGroup, group_id)

            if group:
                # Fetch users that belong to this group using JOIN
                result = await session.execute(
                    select(SQLUser.id, SQLUser.handle)
                    .join(SQLUserGroup)
                    .where(SQLUserGroup.group_id == group_id)
                    .order_by(SQLUser.handle)
                )

                users = [
                    UserNested(id=user_id, handle=handle) for user_id, handle in result
                ]

                return Group(
                    **{
                        **group.to_dict(),
                        "users": users,
                    },
                )

        raise ResourceNotFoundError

    @emits(Operation.CREATE)
    async def create(self, name: str) -> Group:
        """Create new group with the given name.

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
        """Update the name or permissions for a group.

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

        return await self.get(group_id)

    async def delete(self, group_id: int) -> None:
        """Delete a group by its id.

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
            result = await pg_session.execute(
                delete(SQLGroup).where(SQLGroup.id == group_id),
            )

            if not result.rowcount:
                raise ResourceNotFoundError

        emit(group, "groups", "delete", Operation.DELETE)
