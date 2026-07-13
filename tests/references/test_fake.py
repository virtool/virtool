from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.fake.next import DataFaker
from virtool.references.sql import SQLReference


class TestFakeReferenceBuilder:
    """The fake builder creates native references, with an opt-in for legacy ones."""

    async def test_native_by_default(
        self,
        fake: DataFaker,
        pg: AsyncEngine,
    ):
        user = await fake.users.create()

        reference = await fake.references.create(user=user)

        async with AsyncSession(pg) as session:
            legacy_id = await session.scalar(
                select(SQLReference.legacy_id).where(
                    SQLReference.id == reference.id,
                ),
            )

        assert legacy_id is None

    async def test_use_legacy_id(
        self,
        fake: DataFaker,
        pg: AsyncEngine,
    ):
        user = await fake.users.create()

        reference = await fake.references.create(user=user, use_legacy_id=True)

        async with AsyncSession(pg) as session:
            legacy_id = await session.scalar(
                select(SQLReference.legacy_id).where(
                    SQLReference.id == reference.id,
                ),
            )

        assert legacy_id is not None
