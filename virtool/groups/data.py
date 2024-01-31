import asyncio
import math
from typing import List

from sqlalchemy import delete, select, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from virtool_core.models.group import GroupMinimal, Group, GroupSearchResult
from virtool_core.models.user import UserNested


from virtool.authorization.client import AuthorizationClient
from virtool.data.errors import ResourceNotFoundError, ResourceConflictError
from virtool.data.events import emits, Operation, emit
from virtool.data.topg import both_transactions
from virtool.data.transforms import apply_transforms
from virtool.groups.mongo import (
    update_member_users_and_api_keys,
)
from virtool.groups.oas import UpdateGroupRequest
from virtool.groups.pg import SQLGroup
from virtool.mongo.core import Mongo
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

    async def list(self) -> List[GroupMinimal]:
        """
        List all user groups.

        :return: a list of all user groups

        """
        async with AsyncSession(self._pg) as session:
            result = await session.execute(select(SQLGroup))
            return [GroupMinimal(**group.to_dict()) for group in result.scalars()]

    async def find(
        self, page: int, per_page: int, paginate=False, term: str | None = None
    ) -> List[GroupMinimal]:
        """
        Finds all user groups matching the term

        :return: a list of all user groups

        """
        if paginate:
            return await self._find_beta(page, per_page, term)

        return await self.list()

    async def _find_beta(
        self, page: int, per_page: int, term: str | None = None
    ) -> GroupSearchResult:

        total_query = (
            select(func.count(SQLGroup.id).label("total"))
            .subquery()
        )

        found_query = (
            select(func.count(SQLGroup.id).label("found"))
            .where(SQLGroup.name.ilike(f"%{term}%"))
            .subquery()
        )

        skip = 0

        if page > 1:
            skip = (page - 1) * per_page

        async with AsyncSession(self._pg) as session:
            query = (
                select(SQLGroup)
                .offset(skip)
                .limit(per_page)
            )

            total_count_results, found_count_results, results = await asyncio.gather(
                session.execute(select(total_query)),
                session.execute(select(found_query)),
                session.execute(query),
            )

            total_count = total_count_results.scalar()
            found_count = found_count_results.scalar()

            groups = [row.to_dict() for row in results.unique().scalars()]

        return GroupSearchResult(
            items=groups,
            found_count=found_count,
            total_count=total_count,
            page=page,
            page_count=int(math.ceil(found_count / per_page)),
            per_page=per_page,
        )

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
            result = await pg_session.execute(
                delete(SQLGroup).where(SQLGroup.id == group_id)
            )

            if not result.rowcount:
                raise ResourceNotFoundError

            await update_member_users_and_api_keys(
                self._mongo, mongo_session, pg_session, group_id
            )

        emit(group, "groups", "delete", Operation.DELETE)
