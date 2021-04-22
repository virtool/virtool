from sqlalchemy import select

from virtool.subtractions.models import SubtractionFile
from virtool.subtractions.tasks import AddSubtractionFilesTask
from virtool.tasks.models import Task


async def test_add_subtraction_files_task(tmpdir, spawn_client, dbi, pg_session,
                                          static_time):
    client = await spawn_client(authorize=True)
    client.app["settings"]["data_path"] = str(tmpdir)

    test_dir = tmpdir.mkdir("subtractions").mkdir("foo")
    test_dir.join("subtraction.fa.gz").write("FASTA file")
    test_dir.join("subtraction.1.bt2").write("Bowtie2 file")

    subtraction = {
        "_id": "foo",
        "name": "Foo",
        "nickname": "Foo Subtraction",
        "deleted": False
    }

    await client.db.subtraction.insert_one(subtraction)

    task = Task(
        id=1,
        complete=False,
        context={},
        count=0,
        progress=0,
        step="rename_index_files",
        type="add_subtraction_files",
        created_at=static_time.datetime
    )

    async with pg_session as session:
        session.add(task)
        await session.commit()

    add_files_task = AddSubtractionFilesTask(client.app, 1)

    await add_files_task.run()

    rows = list()
    async with pg_session as session:
        files = (await session.execute(select(SubtractionFile))).scalars().all()
        for file in files:
            rows.append(file.to_dict())

    assert rows == [
        {
            'id': 1,
            'name': 'subtraction.1.bt2',
            'subtraction': 'foo',
            'type': 'bowtie2',
            'size': 12
        },
        {
            'id': 2,
            'name': 'subtraction.fa.gz',
            'subtraction': 'foo',
            'type': 'fasta',
            'size': 10
        }
    ]
