import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from virtool.uploads.models import Upload


@pytest.fixture
async def test_uploads(pg, fake2, static_time):
    user_1 = await fake2.users.create()
    user_2 = await fake2.users.create()

    async with AsyncSession(pg) as session:
        session.add_all(
            [
                Upload(id=1, name="test.fq.gz", type="reads", user=user_1.id),
                Upload(
                    id=2,
                    name="test.fq.gz",
                    ready=True,
                    type="reference",
                    user=user_1.id,
                ),
                Upload(id=3, name="test.fq.gz", user=user_2.id),
            ]
        )
        await session.commit()
