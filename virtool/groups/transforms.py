"""Transforms for attaching groups to resources.

TODO: Drop legacy group id support when we fully migrate to integer ids.
"""

from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.data.topg import compose_legacy_id_multi_expression
from virtool.data.transforms import AbstractTransform
from virtool.groups.pg import SQLGroup
from virtool.types import Document


class AttachPrimaryGroupTransform(AbstractTransform):
    """Attach a minimal primary group to one or more documents with a ``primary_group``
    field.
    """

    def __init__(self, pg: AsyncEngine):
        self._pg = pg

    async def attach_one(self, document: Document, prepared: Any):
        return {**document, "primary_group": prepared}

    async def prepare_one(
        self, document: Document, session: AsyncSession
    ) -> Document | None:
        group_id = document.get("primary_group")

        if group_id is None:
            return None

        if isinstance(group_id, int):
            query = select(SQLGroup).where(SQLGroup.id == group_id)
        else:
            query = select(SQLGroup).where(SQLGroup.legacy_id == group_id)

        group = (await session.execute(query)).scalars().one_or_none()

        if group:
            return group.to_dict()

        return None

    async def prepare_many(
        self, documents: list[Document], session: AsyncSession
    ) -> Document:
        group_ids: list[int | str] = list(
            {
                document.get("primary_group")
                for document in documents
                if document.get("primary_group")
            }
        )

        if not group_ids:
            return {document["id"]: None for document in documents}

        expr = compose_legacy_id_multi_expression(SQLGroup, group_ids)

        groups = (await session.execute(select(SQLGroup).where(expr))).scalars().all()

        group_id_map = {
            **{group.id: group.to_dict() for group in groups},
            **{group.legacy_id: group.to_dict() for group in groups},
        }

        return {
            document["id"]: group_id_map.get(document.get("primary_group"))
            for document in documents
        }


class AttachGroupsTransform(AbstractTransform):
    """Attach minimal groups to one or more documents containing a ``groups`` field"""

    def __init__(self, pg: AsyncEngine):
        self._pg = pg

    async def attach_one(self, document: Document, prepared: Any):
        return {**document, "groups": sorted(prepared, key=lambda d: d["name"])}

    async def prepare_one(
        self, document: Document, session: AsyncSession
    ) -> list[Document]:
        if not document["groups"]:
            return []

        query = select(SQLGroup).where(
            compose_legacy_id_multi_expression(SQLGroup, document["groups"])
        )

        return [
            group.to_dict() for group in (await session.execute(query)).scalars().all()
        ]

    async def prepare_many(
        self, documents: list[Document], session: AsyncSession
    ) -> dict[int | str, Any]:
        group_ids = {group for document in documents for group in document["groups"]}

        if not group_ids:
            return {document["id"]: [] for document in documents}

        query = select(SQLGroup).where(
            compose_legacy_id_multi_expression(SQLGroup, group_ids)
        )

        groups = [g.to_dict() for g in (await session.execute(query)).scalars().all()]

        groups_map = {
            **{group["id"]: group for group in groups},
            **{group["legacy_id"]: group for group in groups},
        }

        return {
            document["id"]: [groups_map[group_id] for group_id in document["groups"]]
            for document in documents
        }
