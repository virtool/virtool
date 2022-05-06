from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, AsyncEngine

from virtool.tasks.models import Task
from virtool.uploads.models import Upload
from virtool.uploads.tasks import MigrateFilesTask


async def test_migrate_files_task(
    snapshot, dbi, spawn_client, static_time, pg: AsyncEngine,
):
    client = await spawn_client(authorize=True)
    await client.db.files.insert_one(
        {
            "_id": "07a7zbv6-17NR001b_S23_R1_001.fastq.gz",
            "name": "17NR001b_S23_R1_001.fastq.gz",
            "type": "reads",
            "user": {"id": "test"},
            "uploaded_at": static_time.datetime,
            "reserved": False,
            "ready": True,
            "size": 1234567,
        }
    )

    task = Task(
        id=1,
        complete=False,
        context={},
        count=0,
        progress=0,
        step="transform_documents_to_rows",
        type="migrate_files",
        created_at=static_time.datetime,
    )
    async with AsyncSession(pg) as session:
        session.add(task)
        await session.commit()

    files_task = MigrateFilesTask(client.app, 1)
    await files_task.run()

    async with AsyncSession(pg) as session:
        assert (
            await session.execute(select(Upload).filter_by(id=1))
        ).scalar() == snapshot

    assert await dbi.files.find().to_list(None) == []
