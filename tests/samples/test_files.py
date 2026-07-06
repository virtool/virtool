from datetime import datetime

import pytest
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
        session.add(
            SQLLegacySample(
                legacy_id="sample_1",
                name="sample_1",
                library_type=LibraryType.normal.value,
                created_at=datetime(2015, 10, 6, 20, 0),
            ),
        )
        await session.commit()

    await create_reads_file(
        pg,
        123456,
        "reads_1.fq.gz",
        "reads_1.fq.gz",
        "sample_1",
    )

    async with AsyncSession(pg) as session:
        reads = (await session.execute(select(SQLSampleReads).filter_by(id=1))).scalar()

    assert reads == snapshot
    assert reads.sample_id is not None


async def test_create_reads_file_unknown_sample_raises(pg: AsyncEngine):
    """Creating a reads file for a sample with no ``legacy_samples`` row is a
    data-integrity error and must fail loudly rather than store a NULL sample_id.
    """
    with pytest.raises(ValueError, match="No legacy_samples row for sample"):
        await create_reads_file(
            pg,
            123456,
            "reads_1.fq.gz",
            "reads_1.fq.gz",
            "missing_sample",
        )
