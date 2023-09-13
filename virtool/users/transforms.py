import asyncio
from typing import Any, TYPE_CHECKING

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.data.transforms import AbstractTransform
from virtool.groups.pg import SQLGroup
from virtool.groups.utils import merge_group_permissions
from virtool.types import Document

if TYPE_CHECKING:
    from virtool.mongo.core import Mongo


class AttachPermissionsTransform(AbstractTransform):
    """
    Attaches permissions to a user document.
    """

    def __init__(self, mongo: "Mongo", pg: AsyncEngine):
        self._mongo = mongo
        self._pg = pg

    async def attach_one(self, document, prepared) -> Document:
        """
        Attach permissions to a user document.

        :param document: the user document
        :param prepared: list of groups associated with the user
        :return: the user document with permissions attached
        """
        return {
            **document,
            "permissions": merge_group_permissions(prepared),
        }

    async def prepare_one(self, document) -> list[Document]:
        """
        prepares a list of groups associated with a user.

        :param document: the user document
        :return: a list of groups associated with the user
        """
        return list(
            (
                await self.get_groups_from_ids(self.get_group_ids_from_user(document))
            ).values()
        )

    async def prepare_many(self, documents: list[Document]) -> dict[int | str, Any]:
        """
        Prepares a list of groups associated with each user in a list of user documents.

        :param documents: a list of user documents
        :return: a dictionary of groups associated with a list of users
        """
        group_ids = set()
        prepared = {}

        for user in documents:
            user_groups = self.get_group_ids_from_user(user)

            prepared[user["id"]] = user_groups
            group_ids.update(set(user_groups))

        all_groups = await self.get_groups_from_ids(list(group_ids))

        return {
            user_id: [all_groups[group] for group in groups]
            for user_id, groups in prepared.items()
        }

    async def get_groups_from_ids(self, group_ids: list[str]) -> dict[str, Document]:
        """
        Get a dictionary of groups from a list of group ids.

        :param group_ids: a list of group ids
        :return: a dictionary of groups
        """
        if not group_ids:
            return {}

        async with AsyncSession(self._pg) as pg_session:
            mongo_result, pg_result = await asyncio.gather(
                self._mongo.groups.find({"_id": {"$in": list(group_ids)}}).to_list(
                    None
                ),
                pg_session.execute(
                    select(SQLGroup).filter(SQLGroup.legacy_id.in_(list(group_ids)))
                ),
            )

            mongo_groups = {group["_id"]: group for group in mongo_result}
            pg_groups = {
                group.legacy_id: group.to_dict() for group in pg_result.scalars()
            }

            return mongo_groups | pg_groups

    @staticmethod
    def get_group_ids_from_user(user: Document) -> list[str]:
        """
        Get a list of group ids from a user document.

        :param user: the user document
        :return: the group id
        """
        return [
            group if isinstance(group, str) else group["id"] for group in user["groups"]
        ]
