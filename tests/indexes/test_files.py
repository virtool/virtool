from sqlalchemy import select

import virtool.indexes.files
from virtool.indexes.models import IndexFile


async def test_create_index_file(spawn_client, pg, pg_session):
    index_file = await virtool.indexes.files.create_index_file(pg, "foo", "bowtie2", "reference.1.bt2")

    async with pg_session as session:
        result = (await session.execute(select(IndexFile).filter_by(id=1))).scalar()

    assert index_file == result.to_dict() == {
        'id': 1,
        'name': 'reference.1.bt2',
        'reference': 'foo',
        'type': 'bowtie2',
        'size': None
    }
