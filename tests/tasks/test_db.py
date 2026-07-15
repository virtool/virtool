from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

import virtool.tasks.db
from virtool.tasks.sql import SQLTask
from virtool.tasks.task import BaseTask


class DummyTask(BaseTask):
    name = "dummy_task"


class TestCreate:
    async def test_commits_with_caller_session(self, pg: AsyncEngine):
        async with AsyncSession(pg) as session:
            task = await virtool.tasks.db.create(
                session,
                DummyTask,
                {"owner": "caller"},
            )
            await session.commit()

        async with AsyncSession(pg) as session:
            persisted = await session.scalar(
                select(SQLTask).where(SQLTask.id == task.id)
            )

        assert persisted is not None
        assert persisted.context == {"owner": "caller"}
        assert persisted.type == DummyTask.name

    async def test_rolls_back_with_caller_session(self, pg: AsyncEngine):
        async with AsyncSession(pg) as session:
            task = await virtool.tasks.db.create(
                session,
                DummyTask,
                {"owner": "caller"},
            )
            await session.rollback()

        async with AsyncSession(pg) as session:
            assert (
                await session.scalar(select(SQLTask).where(SQLTask.id == task.id))
                is None
            )
