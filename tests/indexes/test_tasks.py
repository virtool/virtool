from virtool.indexes.models import IndexFile
from sqlalchemy import select

from virtool.indexes.tasks import AddIndexFilesTask
from virtool.tasks.models import Task


async def test_add_index_files(spawn_client, pg_session, static_time, tmp_path):
    client = await spawn_client(authorize=True, administrator=True)
    client.app["settings"]["data_path"] = tmp_path

    test_dir = tmp_path / "references" / "foo"
    test_dir.mkdir(parents=True)
    test_dir.joinpath("reference.fa.gz").write_text("FASTA file")
    test_dir.joinpath("reference.1.bt2").write_text("Bowtie2 file")

    index = {
        "_id": "foo",
        "name": "Foo",
        "nickname": "Foo Index",
        "deleted": False
    }

    await client.db.indexes.insert_one(index)

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

    add_index_files_task = AddIndexFilesTask(client.app, 1)

    await add_index_files_task.run()

    rows = list()
    async with pg_session as session:
        files = (await session.execute(select(IndexFile))).scalars().all()
        for file in files:
            rows.append(file.to_dict())

    assert rows == [
        {
            "id": 1,
            "name": "reference.1.bt2",
            "index": "foo",
            "type": "bowtie2",
            "size": 4096
        },
        {
            "id": 2,
            "name": "reference.fa.gz",
            "index": "foo",
            "type": "fasta",
            "size": 4096
        }
    ]