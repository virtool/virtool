from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from virtool.indexes.models import IndexFile
from virtool.pg.utils import delete_row, get_row, get_row_by_id, get_rows


async def test_delete_row(pg: AsyncEngine):
    async with AsyncSession(pg) as session:
        session.add(
            IndexFile(
                id=1, name="reference.1.bt2", index="foo", type="bowtie2", size=1234567
            )
        )
        await session.commit()

    await delete_row(pg, 1, IndexFile)

    async with AsyncSession(pg) as session:
        assert await get_row_by_id(pg, IndexFile, 1) is None


async def test_get_row(snapshot, pg: AsyncEngine):
    async with AsyncSession(pg) as session:
        session.add(
            IndexFile(
                id=1, name="reference.1.bt2", index="foo", type="bowtie2", size=1234567
            )
        )
        await session.commit()

    assert await get_row_by_id(pg, IndexFile, 1) == snapshot
    assert await get_row(pg, IndexFile, ("index", "foo")) == snapshot


async def test_get_rows(snapshot, pg: AsyncEngine):
    index_1 = IndexFile(
        id=1, name="reference.1.bt2", index="foo", type="bowtie2", size=1234567
    )

    index_2 = IndexFile(
        id=2, name="reference.2.bt2", index="foo", type="bowtie2", size=1234567
    )
    index_3 = IndexFile(
        id=3, name="reference.3.bt2", index="foo", type="bowtie2", size=1234567
    )

    async with AsyncSession(pg) as session:
        session.add_all([index_1, index_2, index_3])
        await session.commit()

    assert await get_rows(pg, IndexFile, "index", "foo") == snapshot
