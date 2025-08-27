import math

from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.authorization.client import AuthorizationClient
from virtool.data.errors import ResourceConflictError, ResourceNotFoundError
from virtool.data.events import Operation, emit, emits
from virtool.data.topg import both_transactions
from virtool.groups.models import Group, GroupMinimal, GroupSearchResult
from virtool.groups.mongo import (
    update_member_users_and_api_keys,
)
from virtool.groups.oas import UpdateGroupRequest
from virtool.groups.pg import SQLGroup
from virtool.mongo.core import Mongo
from virtool.users.models_base import UserNested
from virtool.users.utils import generate_base_permissions
from virtool.utils import base_processor


class GroupsData:
    name = "groups"

    def __init__(
        self,
        authorization_client: AuthorizationClient,
        mongo: Mongo,
        pg: AsyncEngine,
    ):
        self._authorization_client = authorization_client
        self._mongo = mongo
        self._pg = pg

    async def list(self) -> list[GroupMinimal]:
        """List all user groups.

        :return: a list of all user groups

        """
        async with AsyncSession(self._pg) as session:
            result = await session.execute(select(SQLGroup).order_by(SQLGroup.name))
            return [GroupMinimal(**group.to_dict()) for group in result.scalars()]

    async def find(self, page: int, per_page: int, term: str = "") -> GroupSearchResult:
        """Finds all user groups matching the term

        :return: a list of all user groups

        """
        if term:
            filters = [SQLGroup.name.ilike(f"%{term}%")]
        else:
            filters = []

        if page > 1:
            skip = (page - 1) * per_page
        else:
            skip = 0

        async with AsyncSession(self._pg) as session:
            count_result = await session.execute(
                select(
                    select(func.count(SQLGroup.id)).where(*filters).label("found"),
                    select(func.count(SQLGroup.id)).label("total"),
                ),
            )

            found_count, total_count = count_result.fetchone()

            result = await session.execute(
                select(SQLGroup)
                .where(*filters)
                .order_by(SQLGroup.name)
                .offset(skip)
                .limit(per_page),
            )

            groups = [row.to_dict() for row in result.unique().scalars()]

        return GroupSearchResult(
            items=groups,
            found_count=found_count,
            total_count=total_count,
            page=page,
            page_count=int(math.ceil(found_count / per_page)),
            per_page=per_page,
        )

    async def get(self, group_id: int) -> Group:
        """Get a single group by its ID.

        :param group_id: the group's ID
        :return: the group
        """
        async with AsyncSession(self._pg) as session:
            group: SQLGroup | None = await session.get(SQLGroup, group_id)

            if group:
                users = [
                    UserNested(**base_processor(user))
                    async for user in self._mongo.users.find({"groups": group_id}).sort(
                        "handle",
                        1,
                    )
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
                await update_member_users_and_api_keys(
                    self._mongo,
                    mongo_session,
                    pg_session,
                    group.id,
                )

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

            await update_member_users_and_api_keys(
                self._mongo,
                mongo_session,
                pg_session,
                group_id,
            )

        emit(group, "groups", "delete", Operation.DELETE)
