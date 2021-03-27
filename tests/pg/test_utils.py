from sqlalchemy import select

import virtool.pg.utils
from virtool.indexes.models import IndexFile


async def test_delete_row(pg, pg_session):
    async with pg_session as session:
        index_file = IndexFile(
            id=1,
            name="reference.1.bt2",
            reference="foo",
            type="bowtie2",
            size=1234567
        )

        session.add(index_file)
        await session.commit()

    await virtool.pg.utils.delete_row(pg, 1, IndexFile)

    async with pg_session as session:
        result = (await session.execute(select(IndexFile).filter_by(id=1))).scalar()

    assert result is None


async def test_get_rows(pg, pg_session):
    index_1 = IndexFile(id=1, name="reference.1.bt2", reference="foo", type="bowtie2", size=1234567)
    index_2 = IndexFile(id=2, name="reference.2.bt2", reference="foo", type="bowtie2", size=1234567)
    index_3 = IndexFile(id=3, name="reference.3.bt2", reference="foo", type="bowtie2", size=1234567)

    async with pg_session as session:
        session.add_all([index_1, index_2, index_3])
        await session.commit()

    results = await virtool.pg.utils.get_rows(pg, "foo", IndexFile, "reference")

    assert len(results.all()) == 3
