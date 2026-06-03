import asyncio
from datetime import timedelta

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from syrupy.assertion import SnapshotAssertion

import virtool.utils
from virtool.data.errors import ResourceConflictError, ResourceNotFoundError
from virtool.data.layer import DataLayer
from virtool.jobs.tasks import JobsTimeoutTask
from virtool.references.tasks import CloneReferenceTask
from virtool.tasks.oas import UpdateTaskRequest
from virtool.tasks.sql import SQLTask
from virtool.tasks.task import BaseTask


class DummyTask(BaseTask):
    name = "dummy_task"

    def __init__(self, task_id, data, context, temp_dir):
        super().__init__(task_id, data, context, temp_dir)

        self.steps = [self.step_one, self.step_two]

    async def step_one(self):
        """An empty first step."""

    async def step_two(self):
        """An empty second step."""


class TestGet:
    async def test_ok(
        self,
        data_layer: DataLayer,
        snapshot_recent: SnapshotAssertion,
    ):
        task_record = await data_layer.tasks.create(
            CloneReferenceTask, {"user_id": "test_1"}
        )

        assert await data_layer.tasks.get(task_record.id) == snapshot_recent

    async def test_not_found(self, data_layer: DataLayer):
        """Test that getting a non-existent task raises ResourceNotFoundError."""
        with pytest.raises(ResourceNotFoundError):
            await data_layer.tasks.get(999)


class TestUpdate:
    @pytest.mark.parametrize(
        "update",
        [
            UpdateTaskRequest(step="two"),
            UpdateTaskRequest(step="three", progress=55),
            UpdateTaskRequest(progress=55),
            UpdateTaskRequest(error="failed_task"),
        ],
        ids=["step", "step_progress", "progress", "error"],
    )
    async def test_ok(
        self,
        update: UpdateTaskRequest,
        data_layer: DataLayer,
        snapshot_recent: SnapshotAssertion,
    ):
        task_initial = await data_layer.tasks.create(DummyTask, {"user_id": "test_1"})

        task_updated = await data_layer.tasks.update(task_initial.id, update)

        assert task_updated.id == task_initial.id
        assert task_updated == snapshot_recent(name="return_value")

        assert await data_layer.tasks.get(task_updated.id) == snapshot_recent(name="pg")

    async def test_not_found(self, data_layer: DataLayer):
        """Test that updating a non-existent task raises ResourceNotFoundError."""
        with pytest.raises(ResourceNotFoundError):
            await data_layer.tasks.update(999, UpdateTaskRequest(step="test"))


class TestComplete:
    async def test_ok(
        self,
        data_layer: DataLayer,
        snapshot_recent: SnapshotAssertion,
    ):
        task_initial = await data_layer.tasks.create(DummyTask, {"user_id": "test_1"})

        task_completed = await data_layer.tasks.complete(task_initial.id)

        assert task_completed.id == task_initial.id
        assert task_completed.complete is True
        assert task_completed.progress == 100
        assert task_completed == snapshot_recent

    async def test_already_complete(self, data_layer: DataLayer):
        """Test that completing an already complete task raises ResourceConflictError."""
        task_initial = await data_layer.tasks.create(DummyTask, {"user_id": "test_1"})

        # Complete the task once
        await data_layer.tasks.complete(task_initial.id)

        # Try to complete it again
        with pytest.raises(ResourceConflictError):
            await data_layer.tasks.complete(task_initial.id)

    async def test_not_found(self, data_layer: DataLayer):
        """Test that completing a non-existent task raises ResourceNotFoundError."""
        with pytest.raises(ResourceNotFoundError):
            await data_layer.tasks.complete(999)


async def _count_tasks(pg: AsyncEngine, task_type: str) -> int:
    async with AsyncSession(pg) as session:
        return await session.scalar(
            select(func.count()).select_from(SQLTask).filter_by(type=task_type)
        )


class TestCreatePeriodic:
    async def test_spawns_when_none_exists(
        self,
        data_layer: DataLayer,
        pg: AsyncEngine,
    ):
        """Spawn a task when no recent task of the type exists."""
        task = await data_layer.tasks.create_periodic(DummyTask, 600)

        assert task is not None
        assert task.type == DummyTask.name
        assert await _count_tasks(pg, DummyTask.name) == 1

    async def test_skips_when_recent_exists(
        self,
        data_layer: DataLayer,
        pg: AsyncEngine,
    ):
        """Do not spawn when a task was created within the interval."""
        await data_layer.tasks.create(DummyTask, {})

        task = await data_layer.tasks.create_periodic(DummyTask, 600)

        assert task is None
        assert await _count_tasks(pg, DummyTask.name) == 1

    async def test_spawns_when_existing_is_stale(
        self,
        data_layer: DataLayer,
        pg: AsyncEngine,
    ):
        """Spawn when the most recent task is older than the interval."""
        async with AsyncSession(pg) as session:
            session.add(
                SQLTask(
                    complete=True,
                    context={},
                    count=0,
                    created_at=virtool.utils.timestamp() - timedelta(seconds=700),
                    progress=100,
                    step=DummyTask.name,
                    type=DummyTask.name,
                )
            )
            await session.commit()

        task = await data_layer.tasks.create_periodic(DummyTask, 600)

        assert task is not None
        assert await _count_tasks(pg, DummyTask.name) == 2

    async def test_concurrent_callers_spawn_once(
        self,
        data_layer: DataLayer,
        pg: AsyncEngine,
    ):
        """Only one of many concurrent callers spawns the task."""
        results = await asyncio.gather(
            *(data_layer.tasks.create_periodic(DummyTask, 600) for _ in range(8))
        )

        spawned = [task for task in results if task is not None]

        assert len(spawned) == 1
        assert await _count_tasks(pg, DummyTask.name) == 1


class TestAcquire:
    async def test_ok(
        self,
        data_layer: DataLayer,
        pg: AsyncEngine,
    ):
        """Test basic task acquisition without type filtering."""
        task_record = await data_layer.tasks.create(
            CloneReferenceTask, {"user_id": "test_1"}
        )

        acquired_task = await data_layer.tasks.acquire("test-runner-1")

        assert acquired_task is not None
        assert acquired_task.id == task_record.id

        # Verify task was marked as acquired
        async with AsyncSession(pg) as session:
            result = await session.execute(select(SQLTask).filter_by(id=task_record.id))
            task = result.scalar()

            assert task is not None
            assert task.runner_id == "test-runner-1"
            assert task.acquired_at is not None

    async def test_with_allowed_types(
        self,
        data_layer: DataLayer,
        pg: AsyncEngine,
    ):
        """Test task acquisition with type filtering."""
        task1 = await data_layer.tasks.create(CloneReferenceTask, {})
        task2 = await data_layer.tasks.create(JobsTimeoutTask, {})

        # Only acquire clone_reference tasks
        acquired_task = await data_layer.tasks.acquire(
            "test-runner-1", ["clone_reference"]
        )

        assert acquired_task
        assert acquired_task.id == task1.id

        # Verify only the allowed type was acquired
        async with AsyncSession(pg) as session:
            result = await session.execute(select(SQLTask).filter_by(id=task1.id))
            acquired_task = result.scalar()
            assert acquired_task.runner_id == "test-runner-1"

            result = await session.execute(select(SQLTask).filter_by(id=task2.id))
            not_acquired_task = result.scalar()
            assert not_acquired_task.runner_id is None  # Not acquired

    async def test_no_available_tasks(
        self,
        data_layer: DataLayer,
    ):
        """Test acquisition when no tasks are available."""
        acquired_task = await data_layer.tasks.acquire("test-runner-1")
        assert acquired_task is None

    async def test_no_matching_types(
        self,
        data_layer: DataLayer,
        pg: AsyncEngine,
    ):
        """Test acquisition when no tasks match allowed types."""
        task_record = await data_layer.tasks.create(CloneReferenceTask, {})

        # Try to acquire with different allowed types
        acquired_task = await data_layer.tasks.acquire(
            "test-runner-1", ["timeout_jobs"]
        )
        assert acquired_task is None

        # Verify task was not acquired
        async with AsyncSession(pg) as session:
            result = await session.execute(select(SQLTask).filter_by(id=task_record.id))
            task = result.scalar()
            assert task.runner_id is None
