from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.data.transforms import AbstractTransform
from virtool.history.sql import SQLHistoryDiff
from virtool.types import Document


class AttachDiffTransform(AbstractTransform):
    def __init__(self, pg: AsyncEngine):
        self._pg = pg

    async def attach_one(self, document: Document, prepared: Any) -> Document:
        return {**document, "diff": prepared}

    async def prepare_one(self, document: Document, session: AsyncSession) -> Any:
        if document["diff"] == "postgres":
            result = await session.execute(
                select(SQLHistoryDiff.diff).where(
                    SQLHistoryDiff.change_id == document["id"],
                ),
            )

            return result.scalar_one()

        return document["diff"]
