from sqlalchemy import select

from virtool.tasks.models import Task
from virtool.uploads.models import Upload
from virtool.uploads.tasks import MigrateFilesTask


async def test_migrate_files_task(dbi, spawn_client, static_time, pg, pg_session):
    client = await spawn_client(authorize=True)
    await client.db.files.insert_one(
        {
            "_id": "07a7zbv6-17NR001b_S23_R1_001.fastq.gz",
            "name": "17NR001b_S23_R1_001.fastq.gz",
            "type": "reads",
            "user": {
                "id": "test"
            },
            "uploaded_at": static_time.datetime,
            "reserved": False,
            "ready": True,
            "size": 1234567
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
        created_at=static_time.datetime
    )
    async with pg_session as session:
        session.add(task)
        await session.commit()

    files_task = MigrateFilesTask(client.app, 1)
    await files_task.run()

    async with pg_session as session:
        upload = (await session.execute(select(Upload).filter_by(id=1))).scalar().to_dict()

    assert await dbi.files.find().to_list(None) == []
    assert upload == {
        'id': 1,
        'created_at': None,
        'name': '17NR001b_S23_R1_001.fastq.gz',
        'name_on_disk': '07a7zbv6-17NR001b_S23_R1_001.fastq.gz',
        'ready': True,
        'removed': False,
        'removed_at': None,
        'reserved': False,
        'size': 1234567,
        'type': 'reads',
        'user': 'test',
        'uploaded_at': static_time.datetime
    }
