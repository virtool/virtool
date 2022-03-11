import gzip
from pathlib import Path

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from virtool.indexes.models import IndexFile
from virtool.indexes.tasks import AddIndexFilesTask, AddIndexJSONTask
from virtool.tasks.models import Task


@pytest.mark.parametrize("files", ["DNE", "empty", "full", "not_ready"])
async def test_add_index_files(
    spawn_client, pg_session, static_time, tmp_path, snapshot, files
):
    """
    Test that ``files`` field is populated for index documents in the following cases:

    - Index document has no existing "files" field
    - ``files`` field is an empty list
    - index document is ready to be populated

    """
    client = await spawn_client(authorize=True, administrator=True)
    client.app["config"].data_path = tmp_path

    test_dir = tmp_path / "references" / "ref" / "index"
    test_dir.mkdir(parents=True)
    test_dir.joinpath("reference.fa.gz").write_text("FASTA file")
    test_dir.joinpath("reference.1.bt2").write_text("Bowtie2 file")

    index = {
        "_id": "index",
        "name": "Foo",
        "nickname": "Foo Index",
        "deleted": False,
        "ready": True,
        "reference": {"id": "ref"},
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
        created_at=static_time.datetime,
    )

    async with pg_session as session:
        session.add(task)
        await session.commit()

    add_index_files_task = AddIndexFilesTask(client.app, 1)

    await add_index_files_task.run()

    async with pg_session as session:
        assert (await session.execute(select(IndexFile))).scalars().all() == snapshot


async def test_add_index_json(
    pg,
    reference,
    spawn_client,
    snapshot,
    static_time,
    test_otu,
    test_sequence,
    tmp_path,
):
    client = await spawn_client(authorize=True, administrator=True)
    client.app["config"].data_path = Path(tmp_path)

    test_sequence["accession"] = "KX269872"

    await client.db.otus.insert_one(test_otu)
    await client.db.sequences.insert_one(test_sequence)

    ref_id = test_otu["reference"]["id"]

    await client.db.references.insert_one({**reference, "_id": ref_id})
    await client.db.indexes.insert_one(
        {
            "_id": "index_1",
            "deleted": False,
            "manifest": {test_otu["_id"]: test_otu["version"]},
            "ready": True,
            "reference": {"id": ref_id},
        }
    )

    index_dir = tmp_path / "references" / ref_id / "index_1"
    index_dir.mkdir(parents=True)

    async with AsyncSession(pg) as session:
        session.add(
            Task(
                id=1,
                complete=False,
                context={},
                count=0,
                progress=0,
                step="add_index_json_file",
                type="add_index_json",
                created_at=static_time.datetime,
            )
        )
        await session.commit()

    task = AddIndexJSONTask(client.app, 1)

    await task.run()

    async with AsyncSession(pg) as session:
        assert (
            await session.execute(
                select(IndexFile).where(IndexFile.name == "reference.json.gz")
            )
        ).scalars().all() == snapshot

    with gzip.open(Path(index_dir) / "reference.json.gz", "rt") as f:
        assert f.read() == snapshot(name="json")
