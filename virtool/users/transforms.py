import asyncio
from typing import List, Dict, Any, Union, Optional, TYPE_CHECKING

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.data.topg import both_transactions
from virtool.groups.pg import SQLGroup
from virtool.groups.utils import merge_group_permissions
from virtool.mongo.transforms import AbstractTransform
from virtool.tasks.models import Task as SQLTask
from virtool.types import Document
from virtool.utils import get_safely

if TYPE_CHECKING:
    from virtool.mongo.core import Mongo


class AttachPermissionsTransform(AbstractTransform):
    """
    Attaches more complete task data to a document with a `task.id` field.
    """

    def __init__(self, pg: AsyncEngine, mongo: "Mongo"):
        self._pg = pg
        self._mongo = mongo

    async def attach_one(self, document, prepared):
        return {
            **document,
            "permissions": merge_group_permissions(
                [prepared[group_id] for group_id in self.get_group_ids(document)]
            ),
        }

    async def attach_many(
        self, documents: List[Document], prepared: Dict[str, any]
    ) -> List[Document]:
        attached = []

        for document in documents:
            attached.append(
                {
                    **document,
                    "permissions": merge_group_permissions(
                        [
                            prepared[group_id]
                            for group_id in self.get_group_ids(document)
                        ]
                    ),
                }
            )

        return attached

    async def prepare_one(self, document) -> Optional[Document]:
        group_ids = self.get_group_ids(document)
        return await self.get_groups_from_ids(list(group_ids))

    async def prepare_many(
        self, documents: List[Document]
    ) -> Dict[Union[int, str], Any]:
        group_ids = set()

        for user in documents:
            group_ids.update(self.get_group_ids(user))

        return await self.get_groups_from_ids(list(group_ids))

    async def get_groups_from_ids(self, group_ids: list[str]):
        if len(group_ids) == 0:
            return {}

        async with both_transactions(self._mongo, self._pg) as (
            mongo_session,
            pg_session,
        ):

            mongo_result, pg_result = await asyncio.gather(
                self._mongo.groups.find(
                    {"_id": {"$in": group_ids}}, session=mongo_session
                ).to_list(None),
                pg_session.execute(
                    select(SQLGroup).filter(SQLGroup.legacy_id.in_(group_ids))
                ),
            )

            mongo_groups = {group["_id"]: group for group in mongo_result}
            pg_groups = {
                group.legacy_id: group.to_dict() for group in pg_result.scalars()
            }

            return mongo_groups | pg_groups

    @staticmethod
    def get_group_ids(user) -> set[str]:
        groups = get_safely(user, "groups")
        return {get_safely(group, "id") or group for group in groups}
