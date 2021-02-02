from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import virtool.db.utils
import virtool.tasks.task
import virtool.utils
from virtool.tasks.models import Task


async def find(pg_engine):
    documents = list()
    async with AsyncSession(pg_engine) as session:
        tasks = (await session.execute(select(Task))).scalars().all()
        for task in tasks:
            documents.append(task.to_dict())
    return documents


async def get(pg_engine, task_id):
    async with AsyncSession(pg_engine) as session:
        result = await session.execute(select(Task).filter_by(id=task_id))

    return result.scalar()


async def register(pg_engine, task_type, context=None):
    task = Task(
        complete=False,
        context=context or dict(),
        count=0,
        created_at=virtool.utils.timestamp(),
        progress=0,
        type=task_type
    )

    async with AsyncSession(pg_engine) as session:
        session.add(task)
        await session.flush()
        document = task.to_dict()
        await session.commit()

    return virtool.utils.base_processor(document)


async def update(pg_engine, task_id, count=None, progress=None, step=None, context_update=None, error=None):
    async with AsyncSession(pg_engine) as session:
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


async def complete(pg_engine, task_id):
    async with AsyncSession(pg_engine) as session:
        result = await session.execute(select(Task).filter_by(id=task_id))
        task = result.scalar()
        task.complete = True
        task.progress = 100
        await session.commit()


async def remove(pg_engine, task_id):
    async with AsyncSession(pg_engine) as session:
        result = await session.execute(select(Task).filter_by(id=task_id))
        task = result.scalar()

        session.delete(task)
        await session.commit()
