from datetime import UTC, datetime, timedelta, timezone

import pytest
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.tasks.sql import SQLTask


class TestEnforceNaiveUTC:
    """The PostgreSQL write boundary enforces the naive-UTC datetime invariant."""

    async def test_insert_strips_aware_utc(self, pg: AsyncEngine):
        async with AsyncSession(pg) as session:
            session.add(
                SQLTask(
                    id=1,
                    type="add_subtraction_files",
                    created_at=datetime(2020, 1, 1, 12, tzinfo=UTC),
                ),
            )
            await session.commit()

        async with AsyncSession(pg) as session:
            task = await session.get(SQLTask, 1)

            assert task.created_at == datetime(2020, 1, 1, 12)
            assert task.created_at.tzinfo is None

    async def test_insert_rejects_aware_non_utc(self, pg: AsyncEngine):
        async with AsyncSession(pg) as session:
            session.add(
                SQLTask(
                    id=1,
                    type="add_subtraction_files",
                    created_at=datetime(
                        2020, 1, 1, 12, tzinfo=timezone(timedelta(hours=-5))
                    ),
                ),
            )

            with pytest.raises(ValueError, match="aware non-UTC datetime"):
                await session.commit()

    async def test_update_strips_aware_utc(self, pg: AsyncEngine):
        async with AsyncSession(pg) as session:
            session.add(
                SQLTask(
                    id=1,
                    type="add_subtraction_files",
                    created_at=datetime(2020, 1, 1, 12),
                ),
            )
            await session.commit()

        async with AsyncSession(pg) as session:
            task = await session.get(SQLTask, 1)
            task.acquired_at = datetime(2020, 1, 2, 12, tzinfo=UTC)
            await session.commit()

        async with AsyncSession(pg) as session:
            task = await session.get(SQLTask, 1)

            assert task.acquired_at == datetime(2020, 1, 2, 12)
            assert task.acquired_at.tzinfo is None

    async def test_update_rejects_aware_non_utc(self, pg: AsyncEngine):
        async with AsyncSession(pg) as session:
            session.add(
                SQLTask(
                    id=1,
                    type="add_subtraction_files",
                    created_at=datetime(2020, 1, 1, 12),
                ),
            )
            await session.commit()

        async with AsyncSession(pg) as session:
            task = await session.get(SQLTask, 1)
            task.acquired_at = datetime(
                2020, 1, 2, 12, tzinfo=timezone(timedelta(hours=-5))
            )

            with pytest.raises(ValueError, match="aware non-UTC datetime"):
                await session.commit()
