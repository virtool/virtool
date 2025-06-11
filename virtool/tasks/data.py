"""The data layer piece for tasks."""

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

import virtool.utils
from virtool.data.errors import ResourceConflictError, ResourceNotFoundError
from virtool.data.events import Operation, emits
from virtool.tasks.client import AbstractTasksClient
from virtool.tasks.models import Task
from virtool.tasks.oas import UpdateTaskRequest
from virtool.tasks.sql import SQLTask
from virtool.tasks.task import BaseTask


class TasksData:
    name = "tasks"

    def __init__(self, pg: AsyncEngine, tasks_client: AbstractTasksClient):
        self._pg = pg
        self._tasks_client = tasks_client

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
            result = await session.execute(select(SQLTask).filter_by(id=task_id))
            task = result.scalar()

            data = task_update.dict(exclude_unset=True)

            if "progress" in data:
                task.progress = data["progress"]

            if "error" in data:
                task.error = data["error"]

            if "step" in data:
                task.step = data["step"]

            task = Task(**task.to_dict())

            await session.commit()

        return task

    @emits(Operation.UPDATE)
    async def complete(self, task_id: int) -> Task:
        """Update a task record as completed.

        Set complete to ``true`` and progress to ``100``.

        :param task_id: id of the task

        """
        async with AsyncSession(self._pg) as session:
            result = await session.execute(select(SQLTask).filter_by(id=task_id))
            task = result.scalar()

            if task.complete:
                raise ResourceConflictError("Task is already complete")

            task.complete = True
            task.progress = 100

            task = Task(**task.to_dict())

            await session.commit()

        return task

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
        sql_task = SQLTask(
            complete=False,
            context=context or {},
            step=task_class.name,
            count=0,
            created_at=virtool.utils.timestamp(),
            progress=0,
            type=task_class.name,
        )

        async with AsyncSession(self._pg) as session:
            session.add(sql_task)
            await session.flush()
            task = Task(**sql_task.to_dict())
            await session.commit()

        await self._tasks_client.enqueue(task.type, task.id)

        return task
