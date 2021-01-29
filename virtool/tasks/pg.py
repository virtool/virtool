from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

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
