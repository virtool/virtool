from collections.abc import Awaitable
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.data.transforms import AbstractTransform
from virtool.labels.sql import SQLLabel
from virtool.mongo.core import Mongo
from virtool.types import Document


class AttachLabelsTransform(AbstractTransform):
    def __init__(self, pg: AsyncEngine):
        self._pg = pg

    async def _fetch_labels(
        self, label_ids: list[int], session: AsyncSession
    ) -> list[Document]:
        results = await session.execute(
            select(SQLLabel).where(SQLLabel.id.in_(label_ids))
        )

        return [label.to_dict() for label in results.scalars()]

    async def attach_one(self, document: Document, prepared: Any) -> Document:
        return {**document, "labels": prepared}

    async def prepare_one(self, document, session: AsyncSession):
        if document.get("labels"):
            return await self._fetch_labels(document["labels"], session)

        return []

    async def prepare_many(self, documents, session: AsyncSession):
        label_ids = {
            label_id
            for document in documents
            if document.get("labels")
            for label_id in document["labels"]
        }

        labels_by_id = {
            label["id"]: label
            for label in await self._fetch_labels(list(label_ids), session)
        }

        return {
            document["id"]: [labels_by_id[label_id] for label_id in document["labels"]]
            for document in documents
        }


class AttachSampleCountsTransform(AbstractTransform):
    """Attach the number of associated samples to each label document."""

    def __init__(self, mongo: Mongo):
        self._mongo = mongo

    async def attach_one(self, document: Document, prepared: int) -> Document:
        return {**document, "count": prepared}

    async def prepare_one(self, document, session: AsyncSession) -> Awaitable[Any]:
        return await self._mongo.samples.count_documents({"labels": document["id"]})
