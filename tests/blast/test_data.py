from datetime import timedelta

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.blast.data import BLASTData
from virtool.blast.models import NuVsBlast
from virtool.tasks.models import Task


@pytest.fixture
async def blast_data(dbi, pg, static_time, tasks):
    blast_data = BLASTData(dbi, pg, tasks)

    async with AsyncSession(pg) as session:
        task = Task(created_at=static_time.datetime, type="blast")
        session.add(task)
        await session.flush()

        session.add_all(
            [
                NuVsBlast(
                    analysis_id="analysis",
                    sequence_index=21,
                    task_id=task.id,
                    created_at=static_time.datetime,
                    updated_at=static_time.datetime,
                    last_checked_at=static_time.datetime,
                    ready=False,
                ),
                NuVsBlast(
                    analysis_id="analysis_2",
                    sequence_index=13,
                    task_id=task.id,
                    created_at=static_time.datetime,
                    updated_at=static_time.datetime,
                    last_checked_at=static_time.datetime,
                    ready=False,
                ),
                NuVsBlast(
                    analysis_id="analysis_2",
                    sequence_index=4,
                    task_id=task.id,
                    created_at=static_time.datetime,
                    updated_at=static_time.datetime,
                    last_checked_at=static_time.datetime,
                    ready=False,
                ),
            ]
        )

        await session.commit()

    return blast_data


async def test_update_nuvs_blast(
    blast_data: BLASTData, pg: AsyncEngine, snapshot, static_time
):
    assert (
        await blast_data.update_nuvs_blast(
            "analysis",
            21,
            None,
            static_time.datetime + timedelta(minutes=25),
            "rid",
            True,
            result={"foo": "bar"},
        )
        == snapshot
    )

    async with AsyncSession(pg) as session:
        result = await session.execute(
            select(NuVsBlast).where(NuVsBlast.sequence_index == 21)
        )

        assert result.one() == snapshot


async def test_remove_nuvs_blast(blast_data: BLASTData, pg: AsyncEngine):
    assert await blast_data.remove_nuvs_blast("analysis", 21) == 1

    async with AsyncSession(pg) as session:
        result = await session.execute(select(NuVsBlast))
        assert len(result.scalars().all()) == 2


async def test_list_by_analysis(blast_data: BLASTData, pg: AsyncEngine, snapshot):
    assert await blast_data.list_by_analysis("analysis_2") == snapshot
