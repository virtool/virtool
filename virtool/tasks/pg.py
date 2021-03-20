from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, AsyncEngine

import virtool.db.utils
import virtool.utils
from virtool.tasks.models import Task


async def find(pg: AsyncEngine) -> list:
    """
    Get a list of all task records from SQL database.

    :param pg: an AsyncEngine object
    :return: a list of task records

    """
    documents = list()
    async with AsyncSession(pg) as session:
        tasks = (await session.execute(select(Task))).scalars().all()
        for task in tasks:
            documents.append(task.to_dict())
    return documents


async def get(pg: AsyncEngine, task_id: int) -> dict:
    """
    Get a task record based on the given `task_id` from SQL database.

    :param pg: an AsyncEngine object
    :param task_id: ths ID of the task
    :return: a task record

    """
    document = dict()
    async with AsyncSession(pg) as session:
        result = (await session.execute(select(Task).filter_by(id=task_id))).scalar()
    if result:
        document = result.to_dict()

    return document


async def register(pg, task_runner, task_class, context: dict = None) -> dict:
    """
    Create a new task record and insert it into SQL databse.

    Add the new task to TaskRunner.

    :param pg: an AsyncEngine object
    :param task_runner: a :class:``virtool.tasks.runner.TaskRunner``
    :param task_class: a dict for mapping task string name to task class
    :param context: A dict containing data used by the task
    :return: the new task record

    """
    task = Task(
        complete=False,
        context=context or dict(),
        count=0,
        created_at=virtool.utils.timestamp(),
        progress=0,
        type=task_class.task_type
    )

    async with AsyncSession(pg) as session:
        session.add(task)
        await session.flush()
        document = task.to_dict()
        await session.commit()

    await task_runner.q.put(document["id"])

    return document


async def update(
        pg: AsyncEngine,
        task_id: int,
        count: int = None,
        progress: int = None,
        step: str = None,
        context_update: dict = None,
        error: str = None
) -> dict:
    """
    Update a task record with given `task_id`.

    :param pg: an AsyncEngine object
    :param task_id: ID of the task
    :param count: a counter that can be used to calculate progress
    :param progress: task progress for the current step
    :param step: the step of the current task
    :param context_update: a dict containing data to be updated for context
    :param error: the error for the current task

    :return: the task record

    """
    async with AsyncSession(pg) as session:
        result = await session.execute(select(Task).filter_by(id=task_id))
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
        document = task.to_dict()
        await session.commit()

    return document


async def complete(pg: AsyncEngine, task_id: int):
    """
    Update a task record as completed.

    Set complete to True and progress to 100

    :param pg: an AsyncEngine object
    :param task_id: ID of the task

    """
    async with AsyncSession(pg) as session:
        result = await session.execute(select(Task).filter_by(id=task_id))
        task = result.scalar()
        task.complete = True
        task.progress = 100
        await session.commit()


async def remove(pg: AsyncEngine, task_id: int):
    """
    Delete a task record.

    :param pg: an AsyncEngine object
    :param task_id: ID of the task

    """
    async with AsyncSession(pg) as session:
        result = await session.execute(select(Task).filter_by(id=task_id))
        task = result.scalar()

        session.delete(task)
        await session.commit()
