from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.data.topg import compose_legacy_id_single_expression
from virtool.data.transforms import AbstractTransform
from virtool.history.sql import SQLLegacyHistory, SQLLegacyHistoryDiff
from virtool.types import Document


class AttachDiffTransform(AbstractTransform):
    def __init__(self, pg: AsyncEngine):
        self._pg = pg

    async def attach_one(self, document: Document, prepared: Any) -> Document:
        return {**document, "diff": prepared}

    async def prepare_one(self, document: Document, session: AsyncSession) -> Any:
        result = await session.execute(
            select(SQLLegacyHistoryDiff.diff)
            .join(
                SQLLegacyHistory,
                SQLLegacyHistoryDiff.history_id == SQLLegacyHistory.id,
            )
            .where(
                compose_legacy_id_single_expression(SQLLegacyHistory, document["id"]),
            ),
        )

        return result.scalar_one()
