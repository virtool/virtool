from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.samples.files import create_reads_file
from virtool.samples.models import SampleReads


async def test_create_reads_file(snapshot, pg: AsyncEngine, static_time):
    await create_reads_file(
        pg,
        123456,
        "reads_1.fq.gz",
        "reads_1.fq.gz",
        "sample_1",
    )

    async with AsyncSession(pg) as session:
        assert (
            await session.execute(select(SampleReads).filter_by(id=1))
        ).scalar() == snapshot
