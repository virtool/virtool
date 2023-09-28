from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, AsyncEngine
from virtool_core.models.group import GroupMinimal

from virtool.data.topg import compose_legacy_id_expression
from virtool.data.transforms import AbstractTransform
from virtool.groups.pg import SQLGroup
from virtool.types import Document


class AttachPrimaryGroupTransform(AbstractTransform):
    """
    Attach a minimal primary group to document(s) with a ``primary_group`` field.
    """

    def __init__(self, pg: AsyncEngine):
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

    async def prepare_many(self, documents: list[Document]) -> dict[str, Any]:
        group_ids: list[int | str] = list(
            {
                document.get("primary_group")
                for document in documents
                if document.get("primary_group")
            }
        )

        if not group_ids:
            return {document["id"]: None for document in documents}

        async with AsyncSession(self._pg) as session:
            expr = compose_legacy_id_expression(SQLGroup, group_ids)

            groups = (
                (await session.execute(select(SQLGroup).filter(expr))).scalars().all()
            )

            group_id_map = {
                **{group.id: group.to_dict() for group in groups},
                **{group.legacy_id: group.to_dict() for group in groups},
            }

        return {
            document["id"]: group_id_map.get(document.get("primary_group"))
            for document in documents
        }


class AttachGroupsTransform(AbstractTransform):
    """
    Attach minimal groups to document(s) containing a ``groups`` field
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

    async def prepare_one(self, document: Document) -> list[Document]:
        """
        Prepare a list of groups to be attached to a document

        :param document: an input document with a `groups` field
        :return: a list of groups
        """
        if not document["groups"]:
            return []

        async with AsyncSession(self._pg) as session:
            query = select(SQLGroup).filter(
                compose_legacy_id_expression(SQLGroup, document["groups"])
            )

            return [
                group.to_dict()
                for group in (await session.execute(query)).scalars().all()
            ]

    async def prepare_many(self, documents: list[Document]) -> dict[int | str, Any]:
        """
        Bulk prepare groups for attachment to passed documents

        :param documents: A list of input documents with `groups` fields
        :return: a dictionary of `document["id"]:list[group]` pairs based on each
        document's `groups` field
        """
        group_ids = {group for document in documents for group in document["groups"]}

        if not group_ids:
            return {document["id"]: [] for document in documents}

        async with AsyncSession(self._pg) as session:
            query = select(SQLGroup).filter(
                compose_legacy_id_expression(SQLGroup, group_ids)
            )

            groups = {
                group.id: group.to_dict()
                for group in (await session.execute(query)).scalars()
            }

        return {
            document["id"]: [groups[group_id] for group_id in document["groups"]]
            for document in documents
        }
