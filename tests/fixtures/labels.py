import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from virtool.labels.models import Label


@pytest.fixture
async def test_labels(pg):
    label_1 = Label(id=1, name="Legacy")
    label_2 = Label(id=2, name="Incomplete")
    label_3 = Label(id=3, name="Complete")

    async with AsyncSession(pg) as session:
        session.add_all([label_1, label_2, label_3])

        await session.commit()
