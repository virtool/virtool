from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from syrupy import SnapshotAssertion

from virtool.samples.files import create_reads_file
from virtool.samples.sql import SQLSampleReads


async def test_create_reads_file(
    pg: AsyncEngine, snapshot: SnapshotAssertion, static_time
):
    await create_reads_file(
        pg,
        123456,
        "reads_1.fq.gz",
        "reads_1.fq.gz",
        "sample_1",
    )

    async with AsyncSession(pg) as session:
        assert (
            await session.execute(select(SQLSampleReads).filter_by(id=1))
        ).scalar() == snapshot
