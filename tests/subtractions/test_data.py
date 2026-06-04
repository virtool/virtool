from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.fake.next import DataFaker
from virtool.mongo.core import Mongo
from virtool.subtractions.pg import SQLSubtraction
from virtool.uploads.sql import UploadType


async def test_finalize(
    fake: DataFaker,
    mongo: Mongo,
    pg: AsyncEngine,
    snapshot_recent,
):
    """A finalized subtraction is dual-written to both Mongo and Postgres."""
    user = await fake.users.create()
    upload = await fake.uploads.create(
        user=user,
        upload_type=UploadType.subtraction,
        name="malus.fa.gz",
    )
    subtraction = await fake.subtractions.create(user=user, upload=upload)

    assert subtraction == snapshot_recent(name="obj")
    assert await mongo.subtraction.find_one() == snapshot_recent(name="mongo")

    async with AsyncSession(pg) as session:
        row = (await session.execute(select(SQLSubtraction))).scalar_one()

    assert row.to_dict() == snapshot_recent(name="pg")
    assert row.legacy_id == subtraction.id
