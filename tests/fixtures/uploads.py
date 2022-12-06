from datetime import datetime

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

import virtool.utils
from virtool.uploads.models import Upload


@pytest.fixture
async def test_uploads(pg, fake2, static_time):
    user_1 = await fake2.users.create()
    user_2 = await fake2.users.create()

    async with AsyncSession(pg) as session:
        session.add_all(
            [
                Upload(
                    id=1,
                    name="test.fq.gz",
                    type="reads",
                    user=user_1.id,
                    created_at=virtool.utils.timestamp(),
                    name_on_disk="1-Test.fq.gz",
                    size=9081,
                    uploaded_at=virtool.utils.timestamp(),
                ),
                Upload(
                    id=2,
                    name="test.fq.gz",
                    ready=True,
                    type="reference",
                    user=user_1.id,
                    created_at=virtool.utils.timestamp(),
                    name_on_disk="2-Test.fq.gz",
                    size=9081,
                    uploaded_at=virtool.utils.timestamp(),
                ),
                Upload(
                    id=3,
                    name="test.fq.gz",
                    user=user_2.id,
                    type="subtraction",
                    created_at=virtool.utils.timestamp(),
                    name_on_disk="3-Test.fq.gz",
                    size=9081,
                    uploaded_at=virtool.utils.timestamp(),
                ),
            ]
        )
        await session.commit()


@pytest.fixture
async def test_upload():
    return Upload(
        id=1,
        name="test.fq.gz",
        size=123456,
        type="hmm",
        created_at=virtool.utils.timestamp(),
        uploaded_at=virtool.utils.timestamp(),
        user="test",
        name_on_disk="1-Test.fq.gz",
    )


@pytest.fixture
async def hmm_uploads(fake2, pg, static_time):
    user_1 = await fake2.users.create()

    async with AsyncSession(pg) as session:
        session.add_all(
            [
                Upload(
                    id=1,
                    name="test.fq.gz",
                    ready=True,
                    user=user_1.id,
                    type="hmm",
                    created_at=virtool.utils.timestamp(),
                    name_on_disk="1-Test.fq.gz",
                    size=9081,
                    uploaded_at=virtool.utils.timestamp(),
                ),
                Upload(
                    id=2,
                    name="test.fq.gz",
                    ready=True,
                    user=user_1.id,
                    type="hmm",
                    created_at=datetime(2014, 7, 27),
                    name_on_disk="2-Test.fq.gz",
                    size=9081,
                    uploaded_at=datetime(2014, 7, 27),
                ),
                Upload(
                    id=3,
                    name="test.fq.gz",
                    ready=True,
                    user=user_1.id,
                    type="hmm",
                    created_at=datetime(2013, 9, 15),
                    name_on_disk="3-Test.fq.gz",
                    size=9081,
                    uploaded_at=datetime(2013, 9, 15),
                ),
            ]
        )
        await session.commit()
