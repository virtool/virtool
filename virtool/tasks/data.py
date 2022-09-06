from typing import List

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from virtool_core.models.task import Task as Task

import virtool.utils
from virtool.data.errors import ResourceNotFoundError
from virtool.tasks.models import Task as SQLTask


class TasksData:
    def __init__(self,  pg: AsyncEngine):
        self._pg = pg

    async def find(self) -> List[Task]:
        """
        Get a list of all tasks.

        :return: a list of task records

        """
        async with AsyncSession(self._pg) as session:
            return [Task(**task.to_dict()) for task in (await session.execute(select(SQLTask))).scalars().all()]

    async def get(self, task_id: int) -> Task:
        """
        Get the task corresponding with passed "task_id".

        :param task_id: ths ID of the task
        :return: a task record

        """
        async with AsyncSession(self._pg) as session:
            result = (await session.execute(select(SQLTask).filter_by(id=task_id))).scalar()

        if result is None:
            raise ResourceNotFoundError

        return Task(**result.to_dict())

    async def register(self, task_class, context: dict = None) -> Task:
        """
        Create a new task record and store it.

        :param task_class: a subclass of a Virtool :class:`~virtool.tasks.task.Task`
        :param context: A dict containing data used by the task

        :return: the new task record

        """
        task = SQLTask(
            complete=False,
            context=context or {},
            step=task_class.task_type,
            count=0,
            created_at=virtool.utils.timestamp(),
            progress=0,
            type=task_class.task_type,
        )

        async with AsyncSession(self._pg) as session:
            session.add(task)
            await session.flush()
            document = task.to_dict()
            await session.commit()
        return Task(**document)

    async def update(
            self,
            task_id: int,
            count: int = None,
            progress: int = None,
            step: str = None,
            context_update: dict = None,
            error: str = None,
    ) -> Task:
        """
        Update a task record with given `task_id`

        :param task_id: ID of the task
        :param count: a counter that can be used to calculate progress
        :param progress: task progress for the current step
        :param step: the step of the current task
        :param context_update: a dict containing data to be updated for context
        :param error: the error for the current task

        :return: the task record

        """
        async with AsyncSession(self._pg) as session:
            result = await session.execute(select(SQLTask).filter_by(id=task_id))
            task = result.scalar()

            if count is not None:
                task.count = count

            if progress is not None:
                task.progress = progress

            if step:
                task.step = step

            if error is not None:
                task.error = error

            if context_update:
                for key, value in context_update.items():
                    task.context[key] = value
            task = Task(**task.to_dict())
            await session.commit()

        return task

    async def complete(self, task_id: int):
        """
        Update a task record as completed.

        Set complete to True and progress to 100

        :param task_id: ID of the task

        """
        async with AsyncSession(self._pg) as session:
            result = await session.execute(select(SQLTask).filter_by(id=task_id))
            task = result.scalar()
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

            session.delete(task)
            await session.commit()
