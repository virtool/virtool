"""Database operations for tasks."""

from sqlalchemy.ext.asyncio import AsyncSession

import virtool.utils
from virtool.tasks.models import Task
from virtool.tasks.sql import SQLTask
from virtool.tasks.task import BaseTask


async def create(
    session: AsyncSession,
    task_class: type[BaseTask],
    context: dict | None = None,
) -> Task:
    """Create a task in a caller-owned PostgreSQL session.

    The task is flushed so its generated ID is available, but the caller owns the
    transaction and must commit it.

    :param session: the PostgreSQL session to create the task in
    :param task_class: the task implementation to register
    :param context: data to pass to the task
    :return: the uncommitted task record
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

    session.add(sql_task)
    await session.flush()

    return Task(**sql_task.to_dict())
