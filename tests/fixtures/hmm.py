import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from virtool.hmm.sql import SQLHMMStatus


@pytest.fixture
def seed_pg_hmm_status(pg):
    """Return a function that mirrors a Mongo HMM status singleton into Postgres."""

    async def func(document: dict) -> None:
        task = document.get("task")

        async with AsyncSession(pg) as session:
            session.add(
                SQLHMMStatus(
                    id=1,
                    errors=document.get("errors", []),
                    installed=document.get("installed"),
                    release=document.get("release"),
                    task_id=task["id"] if task else None,
                    updates=document.get("updates", []),
                ),
            )
            await session.commit()

    return func
