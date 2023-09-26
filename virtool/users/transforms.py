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
        Prepares a list of groups associated with a user.

        :param document: the user document
        :return: a list of groups associated with the user
        """
        if not document["groups"]:
            return []

        async with AsyncSession(self._pg) as session:
            result = await session.execute(
                select(SQLGroup).filter(SQLGroup.id.in_(document["groups"]))
            )

            return [group.to_dict() for group in result.scalars()]

    async def prepare_many(self, documents: list[Document]) -> dict[int | str, Any]:
        """
        Prepares a dictionary mapping users to a list of member groups.

        :param documents: a list of user documents
        :return: a dictionary of groups associated with a list of users
        """
        all_group_ids = set()
        prepared = {}

        for user in documents:
            all_group_ids |= set(user["groups"])
            prepared[user["id"]] = user["groups"]

        if all_group_ids:
            async with AsyncSession(self._pg) as session:
                result = await session.execute(
                    select(SQLGroup).filter(SQLGroup.id.in_(all_group_ids))
                )

                all_groups_map = {
                    group.id: group.to_dict() for group in result.scalars()
                }

            return {
                user_id: [all_groups_map[group_id] for group_id in group_ids]
                for user_id, group_ids in prepared.items()
            }
        else:
            return {document["id"]: [] for document in documents}
