"""
Work with analyses in the database.

"""
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.analyses.models import SQLAnalysisFile
from virtool.data.transforms import AbstractTransform, apply_transforms
from virtool.indexes.db import get_current_id_and_version
from virtool.subtractions.db import AttachSubtractionTransform
from virtool.types import Document

PROJECTION = (
    "_id",
    "workflow",
    "created_at",
    "index",
    "job",
    "ready",
    "reference",
    "sample",
    "subtractions",
    "updated_at",
    "user",
)

TARGET_FILES = (
    "hmm.tsv",
    "assembly.fa",
    "orfs.fa",
    "unmapped_hosts.fq",
    "unmapped_otus.fq",
)


class AttachAnalysisFileTransform(AbstractTransform):
    def __init__(self, pg: AsyncEngine):
        self._pg = pg

    async def attach_one(self, document: Document, prepared: Any) -> Document:
        return {**document, "files": prepared}

    async def prepare_one(self, document: Document) -> Any:
        async with AsyncSession(self._pg) as session:
            results = (
                (
                    await session.execute(
                        select(SQLAnalysisFile).filter_by(analysis=document["id"])
                    )
                )
                .scalars()
                .all()
            )

        return [result.to_dict() for result in results]
