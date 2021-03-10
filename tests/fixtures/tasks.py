import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from virtool.tasks.models import Task


@pytest.fixture
async def test_tasks(pg, static_time):
    task_1 = Task(id=1, complete=True, progress=100, step="download", type="clone_reference")
    task_2 = Task(id=2, complete=True, progress=100, step="download", type="import_reference")
    task_3 = Task(id=3, complete=False, progress=50, step="decompress", type="update_software")

    async with AsyncSession(pg) as session:
        session.add_all([task_1, task_2, task_3])

        await session.commit()
