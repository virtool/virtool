from typing import Any, Dict, List, Optional, Union, TYPE_CHECKING

import pymongo
from virtool_core.models.group import GroupMinimal

from typing import Any, Dict, List, TYPE_CHECKING

from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession, AsyncEngine
from virtool_core.models.group import GroupMinimal

from virtool.data.transforms import AbstractTransform
from virtool.groups.pg import SQLGroup
from virtool.types import Document
from virtool.utils import base_processor

if TYPE_CHECKING:
    from virtool.mongo.core import Mongo


class AttachPrimaryGroupTransform(AbstractTransform):
    """
    Attach primary groups to document(s) with a `primary_group` field
    """

    def __init__(self, mongo: "Mongo", pg: AsyncEngine):
        self._mongo = mongo
        self._pg = pg

    async def attach_one(self, document: Document, prepared: Any):
        return {**document, "primary_group": prepared}

    async def prepare_one(self, document: Document) -> GroupMinimal | None:
        group_id = document.get("primary_group")

        if group_id is None:
            return None

        async with AsyncSession(self._pg) as session:
            if isinstance(group_id, int):
                query = select(SQLGroup).filter(SQLGroup.id == group_id)
            else:
                query = select(SQLGroup).filter(SQLGroup.legacy_id == group_id)

            group = (await session.execute(query)).scalars().one_or_none()

            if group:
                return group.to_dict()

        return None

    async def prepare_many(self, documents: List[Document]) -> Dict[str, Any]:
        group_ids: List[int] = list(
            {
                document.get("primary_group")
                for document in documents
                if document.get("primary_group")
            }
        )

        async with AsyncSession(self._pg) as session:
            result = await session.execute(
                select(SQLGroup).filter(SQLGroup.id.in_(group_ids))
            )

            groups = {group.id: group.to_dict() for group in result.scalars()}

        return {
            document["id"]: groups.get(document.get("primary_group"))
            for document in documents
        }


class AttachGroupsTransform(AbstractTransform):
    """
    Attach Groups to document(s) containing a `groups` field
    """

    def __init__(self, pg: AsyncEngine):
        self._pg = pg

    async def attach_one(self, document: Document, prepared: Any):
        """
        Attach groups to the document

        :param document: the input document associated with the passed groups
        :param prepared: the list of groups to be attached
        :return: the input document with an attached list of groups
        """
        return {**document, "groups": sorted(prepared, key=lambda d: d["name"])}

    async def prepare_one(self, document: Document) -> List[Dict]:
        """
        Prepare a list of groups to be attached to a document

        :param document: an input document with a `groups` field
        :return: a list of groups
        """
        if not document["groups"]:
            return []

        legacy_group_ids = []
        modern_group_ids = []

        async with AsyncSession(self._pg) as session:
            if modern_group_ids and legacy_group_ids:
                query = select(SQLGroup).filter(
                    or_(
                        SQLGroup.id.in_(modern_group_ids),
                        SQLGroup.legacy_id.in_(legacy_group_ids),
                    )
                )
            elif modern_group_ids:
                query = select(SQLGroup).filter(
                    SQLGroup.id.in_(modern_group_ids),
                )
            else:
                query = select(SQLGroup).filter(
                    SQLGroup.legacy_id.in_(legacy_group_ids),
                )

            result = await session.execute(query)

            return [group.to_dict() for group in result.scalars()]

    async def prepare_many(self, documents: List[Document]) -> Dict[int | str, Any]:
        """
        Bulk prepare groups for attachment to passed documents

        :param documents: A list of input documents with `groups` fields
        :return: a dictionary of `document["id"]:list[group]` pairs based on each
        document's `groups` field
        """
        group_ids = {group for document in documents for group in document["groups"]}

        if not group_ids:
            return {document["id"]: [] for document in documents}

        legacy_group_ids = []
        modern_group_ids = []

        for group_id in group_ids:
            if isinstance(group_id, int):
                modern_group_ids.append(group_id)
            else:
                legacy_group_ids.append(group_id)

        async with AsyncSession(self._pg) as session:
            if modern_group_ids and legacy_group_ids:
                query = select(SQLGroup).filter(
                    or_(
                        SQLGroup.id.in_(group_ids),
                        SQLGroup.legacy_id.in_(group_ids),
                    )
                )
            elif modern_group_ids:
                query = select(SQLGroup).filter(
                    SQLGroup.id.in_(modern_group_ids),
                )
            elif legacy_group_ids:
                query = select(SQLGroup).filter(
                    SQLGroup.legacy_id.in_(legacy_group_ids),
                )

            result = await session.execute(query)

            groups = {group.id: group.to_dict() for group in result.scalars()}

        return {
            document["id"]: [groups[group_id] for group_id in document["groups"]]
            for document in documents
        }
