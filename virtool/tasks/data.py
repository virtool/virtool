import asyncio
from typing import Dict, List, Optional, Type

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from virtool_core.models.task import Task

import virtool.utils
from virtool.data.errors import ResourceNotFoundError
from virtool.tasks.client import AbstractTasksClient
from virtool.tasks.models import Task as SQLTask
from virtool.tasks.oas import TaskUpdate
from virtool.tasks.task import BaseTask


class TasksData:
    def __init__(self, pg: AsyncEngine, tasks_client: AbstractTasksClient):
        self._pg = pg
        self._tasks_client = tasks_client

    async def find(self) -> List[Task]:
        """
        Get a list of all tasks.

        :return: a list of task records

        """
        async with AsyncSession(self._pg) as session:
            return [
                Task(**task.to_dict())
                for task in (await session.execute(select(SQLTask))).scalars().all()
            ]

    async def get(self, task_id: int) -> Task:
        """
        Get the task corresponding with passed "task_id".

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

    async def update(self, task_id: int, task_update: TaskUpdate) -> Task:
        """
        Update a task record with given `task_id`

        :param task_id: the id of the task
        :param task_update: as task update object
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

    async def complete(self, task_id: int):
        """
        Update a task record as completed.

        Set complete to ``true`` and progress to ``100``.

        :param task_id: id of the task

        """
        async with AsyncSession(self._pg) as session:
            result = await session.execute(select(SQLTask).filter_by(id=task_id))
            task = result.scalar()

            if task.complete:
                raise ValueError("Task is already complete")

            task.complete = True
            task.progress = 100

            await session.commit()

    async def remove(self, task_id: int):
        """
        Delete a task record.

        :param task_id: ID of the task

        """
        async with AsyncSession(self._pg) as session:
            result = await session.execute(select(SQLTask).filter_by(id=task_id))
            task = result.scalar()
            await session.delete(task)

            await session.commit()

    async def create(self, task_class: Type[BaseTask], context: dict = None) -> Task:
        """
        Register a new task.

        :param task_class: a subclass of a Virtool :class:`~virtool.tasks.task.Task`
        :param context: A dict containing data used by the task
        :return: the task record

        """
        task = SQLTask(
            complete=False,
            context=context or {},
            step=task_class.name,
            count=0,
            created_at=virtool.utils.timestamp(),
            progress=0,
            type=task_class.name,
        )

        async with AsyncSession(self._pg) as session:
            session.add(task)
            await session.flush()
            task = Task(**task.to_dict())
            await session.commit()

        await self._tasks_client.enqueue(task.type, task.id)

        return task

    async def create_periodically(
        self,
        cls: Type[BaseTask],
        interval: int = None,
        context: Optional[Dict] = None,
    ):
        """
        Register a new task that will be run regularly at the given interval.

        :param cls: a task class
        :param interval: a time interval
        :param context: a dict containing data used by the task
        :return: the task record

        """
        try:
            while True:
                await self.create(cls, context=context)
                await asyncio.sleep(interval)
        except asyncio.CancelledError:
            pass
