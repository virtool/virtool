import asyncio
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

import virtool.history
from virtool.data.transforms import AbstractTransform
from virtool.history.sql import SQLHistoryDiff
from virtool.types import Document


class AttachDiffTransform(AbstractTransform):
    def __init__(self, data_path: Path, pg: AsyncEngine):
        self._data_path = data_path
        self._pg = pg

    async def attach_one(self, document: Document, prepared: Any) -> Document:
        return {**document, "diff": prepared}

    async def prepare_one(self, document: Document) -> Any:
        if document["diff"] == "file":
            otu_id, otu_version = document["id"].split(".")

            return await asyncio.to_thread(
                virtool.history.utils.read_diff_file,
                self._data_path,
                otu_id,
                otu_version,
            )

        if document["diff"] == "postgres":
            async with AsyncSession(self._pg) as session:
                result = await session.execute(
                    select(SQLHistoryDiff.diff).where(
                        SQLHistoryDiff.change_id == document["id"],
                    ),
                )

                return result.scalar_one()

        return document["diff"]
