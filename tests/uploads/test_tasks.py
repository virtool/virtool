from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, AsyncEngine

from virtool.data.layer import DataLayer
from virtool.tasks.models import SQLTask
from virtool.uploads.models import SQLUpload
from virtool.uploads.tasks import MigrateFilesTask


async def test_migrate_files_task(
    snapshot,
    mongo,
    static_time,
    pg: AsyncEngine,
    data_layer: "DataLayer",
):
    await mongo.files.insert_one(
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
    task = SQLTask(
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

    files_task = await MigrateFilesTask.from_task_id(data_layer, 1)

    await files_task.run()

    async with AsyncSession(pg) as session:
        assert (
            await session.execute(select(SQLUpload).filter_by(id=1))
        ).scalar() == snapshot

    assert await mongo.files.find().to_list(None) == []
