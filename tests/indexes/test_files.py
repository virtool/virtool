from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from sqlalchemy import select

import virtool.indexes.files
from virtool.indexes.models import SQLIndexFile


async def test_create_index_file(snapshot, pg: AsyncEngine):
    assert (
        await virtool.indexes.files.create_index_file(
            pg, "foo", "bowtie2", "reference.1.bt2", 9000
        )
        == snapshot
    )

    async with AsyncSession(pg) as session:
        assert (
            await session.execute(select(SQLIndexFile).filter_by(id=1))
        ).scalar() == snapshot
