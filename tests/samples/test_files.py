from sqlalchemy import select

from virtool.samples.files import create_reads_file
from virtool.samples.models import SampleReads


async def test_create_reads_file(pg, pg_session, static_time):
    await create_reads_file(
        pg,
        123456,
        "reads_1.fq.gz",
        "reads_1.fq.gz",
        "sample_1",
    )

    async with pg_session as session:
        result = (await session.execute(select(SampleReads).filter_by(id=1))).scalar()

    assert result.to_dict() == {
        "id": 1,
        "sample": "sample_1",
        "name": "reads_1.fq.gz",
        "name_on_disk": "reads_1.fq.gz",
        "size": 123456,
        "upload": None,
        "uploaded_at": static_time.datetime
    }
