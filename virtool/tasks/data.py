"""The data layer piece for tasks."""

from datetime import timedelta

from sqlalchemy import desc, func, select, text, update
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from structlog import get_logger

import virtool.tasks.db
import virtool.utils
from virtool.data.errors import ResourceConflictError, ResourceNotFoundError
from virtool.data.events import Operation, emit, emits
from virtool.tasks.models import Task, TaskCounts
from virtool.tasks.oas import UpdateTaskRequest
from virtool.tasks.sql import SQLTask
from virtool.tasks.task import BaseTask

logger = get_logger("tasks.data")


class TasksData:
    name = "tasks"

    def __init__(self, pg: AsyncEngine):
        self._pg = pg

    async def find(self) -> list[Task]:
        """Get a list of all tasks.

        :return: a list of task records

        """
        async with AsyncSession(self._pg) as session:
            return [
                Task(**task.to_dict())
                for task in (
                    await session.execute(
                        select(SQLTask).order_by(desc(SQLTask.created_at)),
                    )
                )
                .scalars()
                .all()
            ]

    async def get_counts(self) -> TaskCounts:
        """Get counts of active tasks for autoscaling.

        ``queued`` mirrors the filter used by :meth:`acquire` and is the primary
        scaling signal. ``running`` covers acquired-but-unfinished tasks. Both are
        bounded by outstanding work and served by the ``idx_tasks_active`` partial
        index, so the query cost does not grow with the table's history of
        completed or failed tasks.

        :return: the active task counts

        """
        async with AsyncSession(self._pg) as session:
            queued, running = (
                await session.execute(
                    select(
                        func.count().filter(SQLTask.acquired_at.is_(None)),
                        func.count().filter(SQLTask.acquired_at.is_not(None)),
                    ).where(SQLTask.complete.is_(False), SQLTask.error.is_(None)),
                )
            ).one()

        return TaskCounts(queued=queued, running=running)

    async def get(self, task_id: int) -> Task:
        """Get the task corresponding with passed "task_id".

        :param task_id: ths ID of the task
        :return: a task record

        """
        async with AsyncSession(self._pg) as session:
            result = (
                await session.execute(select(SQLTask).filter_by(id=task_id))
            ).scalar()

        if result:
            return Task(**result.to_dict())

        raise ResourceNotFoundError

    @emits(Operation.UPDATE)
    async def update(self, task_id: int, task_update: UpdateTaskRequest) -> Task:
        """Update a task record with given `task_id`.

        :param task_id: the id of the task
        :param task_update: as task update objectd
        :return: the task record
        """
        async with AsyncSession(self._pg) as session:
            data = task_update.dict(exclude_unset=True)

            result = await session.execute(
                update(SQLTask)
                .where(SQLTask.id == task_id)
                .values(**data)
                .returning(SQLTask)
            )

            updated_task = result.scalar()

            if updated_task is None:
                raise ResourceNotFoundError

            # Convert to dict before committing to avoid lazy loading issues
            task_dict = updated_task.to_dict()
            await session.commit()

            return Task(**task_dict)

    @emits(Operation.UPDATE)
    async def complete(self, task_id: int) -> Task:
        """Update a task record as completed.

        Set complete to ``true`` and progress to ``100``.

        :param task_id: id of the task

        """
        async with AsyncSession(self._pg) as session:
            result = await session.execute(
                update(SQLTask)
                .where(SQLTask.id == task_id, SQLTask.complete == False)
                .values(complete=True, progress=100)
                .returning(SQLTask)
            )

            row = result.scalar()

            if row:
                # Convert to dict before committing to avoid lazy loading issues
                task_dict = row.to_dict()
                await session.commit()
                return Task(**task_dict)

            # Check if task exists but is already complete
            result = await session.execute(
                select(SQLTask.complete).filter_by(id=task_id)
            )

            if result and result.scalar() is True:
                raise ResourceConflictError("Task is already complete")

            raise ResourceNotFoundError

    @emits(Operation.CREATE)
    async def create(
        self,
        task_class: type[BaseTask],
        context: dict | None = None,
    ) -> Task:
        """Register a new task.

        :param task_class: a subclass of :class:`~virtool.tasks.task.SQLTask`
        :param context: data to be passed to the task
        :return: the task record

        """
        async with AsyncSession(self._pg) as session:
            task = await virtool.tasks.db.create(session, task_class, context)
            await session.commit()

        return task

    async def create_periodic(
        self,
        task_class: type[BaseTask],
        interval: int,
    ) -> Task | None:
        """Atomically spawn a periodic task if one is due.

        A Postgres transaction-scoped advisory lock keyed on the task type
        serializes the decision across API replicas. The lock is held across the
        recency check and the insert, so only one replica can spawn a given task
        type per cycle and no duplicate is created.

        :param task_class: the task class to spawn
        :param interval: the minimum interval in seconds between tasks
        :return: the spawned task, or ``None`` if a task was not due or another
            replica held the lock
        """
        if interval <= 0:
            raise ValueError("interval must be a positive number of seconds")

        async with AsyncSession(self._pg) as session:
            locked = await session.scalar(
                select(func.pg_try_advisory_xact_lock(func.hashtext(task_class.name)))
            )

            if not locked:
                return None

            cutoff_time = virtool.utils.timestamp() - timedelta(seconds=interval)

            existing_task = await session.scalar(
                select(SQLTask)
                .filter_by(type=task_class.name)
                .filter(SQLTask.created_at > cutoff_time)
            )

            if existing_task is not None:
                return None

            task = await virtool.tasks.db.create(session, task_class)
            await session.commit()

        emit(task, self.name, "create", Operation.CREATE)

        return task

    async def acquire(
        self, runner_id: str, allowed_types: list[str] | None = None
    ) -> Task | None:
        """Atomically acquire and return the next available task.

        :param runner_id: Unique identifier for the task runner
        :param allowed_types: List of task types this runner can handle, None for all types
        :return: Task object if acquired, None if no tasks available
        """
        acquired_at = virtool.utils.timestamp()

        async with AsyncSession(self._pg) as session:
            if allowed_types:
                result = await session.execute(
                    text("""
                        UPDATE tasks
                        SET acquired_at = :acquired_at, runner_id = :runner_id
                        WHERE id = (
                            SELECT id FROM tasks
                            WHERE acquired_at IS NULL
                              AND complete = FALSE
                              AND error IS NULL
                              AND progress = 0
                              AND type = ANY(:allowed_types)
                            ORDER BY created_at
                            LIMIT 1
                            FOR UPDATE SKIP LOCKED
                        )
                        RETURNING id
                    """),
                    {
                        "runner_id": runner_id,
                        "acquired_at": acquired_at,
                        "allowed_types": allowed_types,
                    },
                )
            else:
                result = await session.execute(
                    text("""
                        UPDATE tasks
                        SET acquired_at = :acquired_at, runner_id = :runner_id
                        WHERE id = (
                            SELECT id FROM tasks
                            WHERE acquired_at IS NULL
                              AND complete = FALSE
                              AND error IS NULL
                              AND progress = 0
                            ORDER BY created_at
                            LIMIT 1
                            FOR UPDATE SKIP LOCKED
                        )
                        RETURNING id
                    """),
                    {"runner_id": runner_id, "acquired_at": acquired_at},
                )

            row = result.fetchone()
            if row:
                await session.commit()
                logger.info("acquired task", task_id=row[0], runner_id=runner_id)
                return await self.get(row[0])

            return None
