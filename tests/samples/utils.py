"""Helpers for seeding sample state that spans Mongo and Postgres."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.mongo.core import Mongo
from virtool.samples.sql import SQLLegacySample, SQLSampleUpload


async def add_sample_uploads(
    mongo: Mongo,
    pg: AsyncEngine,
    legacy_id: str,
    upload_ids: list[int],
) -> None:
    """Attach ``upload_ids`` to the sample ``legacy_id`` in both stores.

    Mirrors what the dual-write in :meth:`SamplesData.create` does: the ordered
    ``uploads`` array on the Mongo document, and one ``sample_uploads`` row per
    upload with ``index`` recording its position.
    """
    await mongo.samples.update_one(
        {"_id": legacy_id},
        {"$set": {"uploads": [{"id": upload_id} for upload_id in upload_ids]}},
    )

    async with AsyncSession(pg) as session:
        sample_pk = (
            await session.execute(
                select(SQLLegacySample.id).where(
                    SQLLegacySample.legacy_id == legacy_id,
                ),
            )
        ).scalar_one()

        for index, upload_id in enumerate(upload_ids):
            session.add(
                SQLSampleUpload(
                    sample=legacy_id,
                    sample_id=sample_pk,
                    upload_id=upload_id,
                    index=index,
                ),
            )

        await session.commit()
