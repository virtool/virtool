import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from virtool.uploads.models import Upload


@pytest.fixture
async def test_uploads(pg, static_time):
    upload_1 = Upload(id=1, name="test.fq.gz", type="reads", user="danny")
    upload_2 = Upload(id=2, name="test.fq.gz", type="reference", user="lester")
    upload_3 = Upload(id=3, name="test.fq.gz", user="jake")

    async with AsyncSession(pg) as session:
        session.add_all([upload_1, upload_2, upload_3])

        await session.commit()
