from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from syrupy import SnapshotAssertion

from virtool.models.enums import LibraryType
from virtool.samples.files import create_reads_file
from virtool.samples.sql import SQLLegacySample, SQLSampleReads


async def test_create_reads_file(
    pg: AsyncEngine, snapshot: SnapshotAssertion, static_time
):
    async with AsyncSession(pg) as session:
        sample = SQLLegacySample(
            legacy_id="sample_1",
            name="sample_1",
            library_type=LibraryType.normal.value,
            created_at=datetime(2015, 10, 6, 20, 0),
        )
        session.add(sample)
        await session.flush()

        sample_pk = sample.id

        await session.commit()

    await create_reads_file(
        pg,
        123456,
        "reads_1.fq.gz",
        "reads_1.fq.gz",
        sample_pk,
        "sample_1",
    )

    async with AsyncSession(pg) as session:
        reads = (await session.execute(select(SQLSampleReads).filter_by(id=1))).scalar()

    assert reads == snapshot
    assert reads.sample_id == sample_pk
