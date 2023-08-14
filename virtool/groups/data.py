import asyncio
from logging import getLogger
from typing import List, TYPE_CHECKING

from pymongo.errors import DuplicateKeyError
from sqlalchemy import update, delete
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncEngine
from virtool_core.models.group import GroupMinimal, Group, Permissions

from virtool.authorization.client import AuthorizationClient
from virtool.data.errors import ResourceNotFoundError, ResourceConflictError
from virtool.data.events import emits, Operation, emit
from virtool.data.topg import both_transactions
from virtool.groups.db import (
    fetch_group_users,
    update_member_users,
    fetch_complete_group,
)
from virtool.groups.oas import UpdateGroupRequest
from virtool.groups.pg import SQLGroup
from virtool.mongo.utils import get_one_field, id_exists
from virtool.pg.utils import get_row, get_row_by_id
from virtool.users.utils import generate_base_permissions
from virtool.utils import base_processor

if TYPE_CHECKING:
    from virtool.mongo.core import Mongo

logger = getLogger("groups")


class GroupsData:
    name = "groups"

    def __init__(
        self, authorization_client: AuthorizationClient, mongo: "Mongo", pg: AsyncEngine
    ):
        self._authorization_client = authorization_client
        self._mongo = mongo
        self._pg = pg

    async def find(self) -> List[GroupMinimal]:
        """
        List all user groups.

        :return: a list of all user groups

        """
        return [
            GroupMinimal(**base_processor(document))
            async for document in self._mongo.groups.find()
        ]

    async def get(self, group_id: str | int) -> Group:
        """
        Get a single group by its ID.

        :param group_id: the group's ID
        :return: the group
        """

        if type(group_id) is int:
            pg_group = await get_row_by_id(self._pg, SQLGroup, group_id)

            if pg_group is None:
                raise ResourceNotFoundError()

        elif type(group_id) is str:
            pg_group = await get_row(self._pg, SQLGroup, ("legacy_id", group_id))
            mongo_group = await fetch_complete_group(self._mongo, group_id)

        if pg_group:
            return Group(
                id=pg_group.legacy_id,
                name=pg_group.name,
                permissions=Permissions(**pg_group.permissions),
                users=await fetch_group_users(self._mongo, pg_group.legacy_id),
            )

        elif mongo_group:
            return mongo_group

        else:
            raise ResourceNotFoundError()

    @emits(Operation.CREATE)
    async def create(self, name: str) -> Group:
        """
        Create new group with the given name.

        :param name: the ID for the new group
        :return: the group
        :raises ResourceConflictError: if a group with the given name already exists
        """
        try:
            async with both_transactions(self._mongo, self._pg) as (
                mongo_session,
                pg_session,
            ):
                document = await self._mongo.groups.insert_one(
                    {"name": name, "permissions": generate_base_permissions()},
                    session=mongo_session,
                )

                pg_session.add(
                    SQLGroup(
                        legacy_id=document["_id"],
                        name=name,
                        permissions=generate_base_permissions(),
                    )
                )
        except (DuplicateKeyError, IntegrityError):
            raise ResourceConflictError("Group already exists")

        return Group(**base_processor(document), users=[])

    @emits(Operation.UPDATE)
    async def update(self, group_id: str, data: UpdateGroupRequest) -> Group:
        """
        Update the permissions for a group.

        :param group_id: the id of the group
        :param data: updates to the current group permissions or name
        :return: the updated group
        :raises ResourceNotFoundError: if the group does not exist

        """
        if not await id_exists(self._mongo.groups, group_id):
            raise ResourceNotFoundError

        data = data.dict(exclude_unset=True)

        async with both_transactions(self._mongo, self._pg) as (
            mongo_session,
            pg_session,
        ):
            db_update = {}

            if "name" in data:
                db_update["name"] = data["name"]

            if "permissions" in data:
                permissions = await get_one_field(
                    self._mongo.groups, "permissions", {"_id": group_id}
                )

                db_update["permissions"] = {**permissions, **data["permissions"]}

            if db_update:
                await asyncio.gather(
                    pg_session.execute(
                        (
                            update(SQLGroup)
                            .where(SQLGroup.legacy_id == group_id)
                            .values(**db_update)
                        )
                    ),
                    self._mongo.groups.update_one(
                        {"_id": group_id}, {"$set": db_update}, session=mongo_session
                    ),
                )

                await update_member_users(self._mongo, group_id, session=mongo_session)

        return await fetch_complete_group(self._mongo, group_id)

    async def delete(self, group_id: str):
        """
        Delete a group by its id.

        Deletes the group in all backing databases. Updates all member user permissions
        if they are affected by deletion of the group.

        :param group_id: the id of the group to delete
        :raises ResourceNotFoundError: if the group is not found

        """
        group = await self.get(group_id)

        async with both_transactions(self._mongo, self._pg) as (
            mongo_session,
            pg_session,
        ):
            mongo_result, pg_result = await asyncio.gather(
                self._mongo.groups.delete_one({"_id": group_id}, session=mongo_session),
                pg_session.execute(
                    delete(SQLGroup).where(SQLGroup.legacy_id == group_id)
                ),
            )

            if not mongo_result.deleted_count:
                raise ResourceNotFoundError

            if not pg_result.rowcount:
                logger.info("Deleted group not found in Postgres id=%s", group_id)

            await update_member_users(
                self._mongo, group_id, remove=True, session=mongo_session
            )

        emit(group, "groups", "delete", Operation.DELETE)
