from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.data.transforms import AbstractTransform
from virtool.history.sql import SQLHistoryDiff
from virtool.history.utils import read_diff_file
from virtool.storage.protocol import StorageBackend
from virtool.types import Document


class AttachDiffTransform(AbstractTransform):
    def __init__(self, storage: StorageBackend, pg: AsyncEngine):
        self._storage = storage
        self._pg = pg

    async def attach_one(self, document: Document, prepared: Any) -> Document:
        return {**document, "diff": prepared}

    async def prepare_one(self, document: Document, session: AsyncSession) -> Any:
        if document["diff"] == "file":
            otu_id, otu_version = document["id"].split(".")
            return await read_diff_file(self._storage, otu_id, otu_version)

        if document["diff"] == "postgres":
            result = await session.execute(
                select(SQLHistoryDiff.diff).where(
                    SQLHistoryDiff.change_id == document["id"],
                ),
            )

            return result.scalar_one()

        return document["diff"]
