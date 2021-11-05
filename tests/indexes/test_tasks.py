import pytest
from sqlalchemy import select

from virtool.indexes.models import IndexFile
from virtool.indexes.tasks import AddIndexFilesTask
from virtool.tasks.models import Task


@pytest.mark.parametrize("files", ["DNE", "empty", "full", "not_ready"])
async def test_add_index_files(spawn_client, pg_session, static_time, tmp_path, snapshot, files):
    """
    Test that "files" field is populated for index documents in the following cases:
    - Index document has no existing "files" field
    - "files" field is an empty list
    - index document is ready to be populated
    """
    client = await spawn_client(authorize=True, administrator=True)
    client.app["config"].data_path = tmp_path

    test_dir = tmp_path / "references" / "foo"
    test_dir.mkdir(parents=True)
    test_dir.joinpath("reference.fa.gz").write_text("FASTA file")
    test_dir.joinpath("reference.1.bt2").write_text("Bowtie2 file")

    index = {
        "_id": "foo",
        "name": "Foo",
        "nickname": "Foo Index",
        "deleted": False,
        "ready": True
    }

    if files == "empty":
        index["files"] = list()

    if files == "full":
        index["files"] = ["full"]

    if files == "not_ready":
        index["ready"] = False

    await client.db.indexes.insert_one(index)

    task = Task(
        id=1,
        complete=False,
        context={},
        count=0,
        progress=0,
        step="rename_index_files",
        type="add_index_files",
        created_at=static_time.datetime
    )

    async with pg_session as session:
        session.add(task)
        await session.commit()

    add_index_files_task = AddIndexFilesTask(client.app, 1)

    await add_index_files_task.run()

    rows = list()
    async with pg_session as session:
        index_files = (await session.execute(select(IndexFile))).scalars().all()
        for file in index_files:
            rows.append(file.to_dict())

    snapshot.assert_match(rows)
