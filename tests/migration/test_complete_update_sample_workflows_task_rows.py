"""Tests for the complete-update_sample_workflows-task-rows migration."""

import asyncio
from collections.abc import Callable

import arrow
import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from assets.revisions.rev_0fhc2sfnpu9v_complete_update_sample_workflows_task_rows import (
    upgrade,
)
from virtool.migration.ctx import MigrationContext
from virtool.tasks.sql import SQLTask


@pytest.fixture
async def setup_tasks(ctx: MigrationContext, apply_alembic: Callable) -> None:
    """Apply alembic head and seed task rows covering each state."""
    await asyncio.to_thread(apply_alembic, "head")

    now = arrow.utcnow().naive

    async with AsyncSession(ctx.pg) as session:
        session.add_all(
            [
                SQLTask(
                    id=1,
                    type="update_sample_workflows",
                    complete=False,
                    error=None,
                    created_at=now,
                    context={},
                    count=0,
                    progress=0,
                ),
                SQLTask(
                    id=2,
                    type="update_sample_workflows",
                    complete=True,
                    error=None,
                    created_at=now,
                    context={},
                    count=0,
                    progress=100,
                ),
                SQLTask(
                    id=3,
                    type="update_sample_workflows",
                    complete=False,
                    error="boom",
                    created_at=now,
                    context={},
                    count=0,
                    progress=0,
                ),
                SQLTask(
                    id=4,
                    type="add_subtraction_files",
                    complete=False,
                    error=None,
                    created_at=now,
                    context={},
                    count=0,
                    progress=0,
                ),
            ],
        )
        await session.commit()


async def test_upgrade(ctx: MigrationContext, setup_tasks: None):
    """Only the incomplete, non-errored rows of the retired type are completed."""
    await upgrade(ctx)

    async with AsyncSession(ctx.pg) as session:
        rows = {
            row.id: row for row in (await session.execute(select(SQLTask))).scalars()
        }

    # The outstanding retired-task row is completed, not deleted, so it still
    # suppresses old spawners via the recency check.
    assert rows[1].complete is True
    assert rows[1].progress == 100

    # Already-complete and errored rows of the retired type are untouched.
    assert rows[2].complete is True
    assert rows[3].complete is False
    assert rows[3].error == "boom"

    # A different task type is left alone.
    assert rows[4].complete is False
