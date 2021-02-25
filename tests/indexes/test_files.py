from sqlalchemy import select

import virtool.indexes.files
from virtool.indexes.models import IndexFile


async def test_create_index_file(spawn_client, pg_engine, pg_session):
    index_file = await virtool.indexes.files.create_index_file(pg_engine, "foo", "bowtie2", "reference.1.bt2")

    async with pg_session as session:
        result = (await session.execute(select(IndexFile).filter_by(id=1))).scalar()

    assert index_file == result.to_dict() == {
        'id': 1,
        'name': 'reference.1.bt2',
        'reference': 'foo',
        'type': 'bowtie2',
        'size': None
    }


async def test_delete_index_file(spawn_client, pg_engine, pg_session):
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

    await virtool.indexes.files.delete_index_file(pg_engine, 1)

    async with pg_session as session:
        result = (await session.execute(select(IndexFile).filter_by(id=1))).scalar()

    assert result is None

