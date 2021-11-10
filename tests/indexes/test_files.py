import virtool.indexes.files
from sqlalchemy import select
from virtool.indexes.models import IndexFile


async def test_create_index_file(snapshot, pg, pg_session):
    assert await virtool.indexes.files.create_index_file(pg, "foo", "bowtie2", "reference.1.bt2") == snapshot

    async with pg_session as session:
        assert (await session.execute(select(IndexFile).filter_by(id=1))).scalar() == snapshot
