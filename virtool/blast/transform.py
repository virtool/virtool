from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.blast.models import NuVsBlast
from virtool.db.transforms import AbstractTransform
from virtool.types import Document


class AttachNuVsBLAST(AbstractTransform):
    """
    Attach BLAST records to NuVs analysis documents.
    """

    def __init__(self, pg: AsyncEngine):
        self._pg = pg

    async def prepare_one(self, document: Document) -> Any:
        async with AsyncSession(self._pg) as session:
            result = await session.execute(
                select(NuVsBlast).where(NuVsBlast.analysis_id == document["id"])
            )

            return {
                blast.sequence_index: {
                    "id": blast.id,
                    "created_at": blast.created_at,
                    "updated_at": blast.updated_at,
                    "last_checked_at": blast.last_checked_at,
                    "interval": blast.interval,
                    "rid": blast.rid,
                    "ready": blast.ready,
                    "result": blast.result,
                }
                for blast in result.scalars()
            }

    async def attach_one(self, document: Document, prepared: Any) -> Document:
        hits = document["results"]["hits"]

        return {
            **document,
            "results": {
                "hits": [{**hit, "blast": prepared.get(hit["index"])} for hit in hits]
            },
        }
