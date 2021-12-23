import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from virtool.uploads.models import Upload


@pytest.fixture
async def test_uploads(pg, fake, static_time):
    user_1 = await fake.users.insert()
    user_2 = await fake.users.insert()

    upload_1 = Upload(id=1, name="test.fq.gz", type="reads", user=user_1["_id"])

    upload_2 = Upload(id=2, name="test.fq.gz", type="reference", user=user_1["_id"])

    upload_3 = Upload(id=3, name="test.fq.gz", user=user_2["_id"])

    async with AsyncSession(pg) as session:
        session.add_all([upload_1, upload_2, upload_3])
        await session.commit()
