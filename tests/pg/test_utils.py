from sqlalchemy import select

import virtool.pg.utils
from virtool.indexes.models import IndexFile


async def test_delete_row(pg, pg_session):
    async with pg_session as session:
        index_file = IndexFile(
            id=1,
            name="reference.1.bt2",
            index="foo",
            type="bowtie2",
            size=1234567
        )

        session.add(index_file)
        await session.commit()

    await virtool.pg.utils.delete_row(pg, 1, IndexFile)

    async with pg_session as session:
        result = (await session.execute(select(IndexFile).filter_by(id=1))).scalar()

    assert result is None
