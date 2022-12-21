import gzip
import os
import shutil
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.subtractions.models import SQLSubtractionFile
from virtool.subtractions.tasks import (
    AddSubtractionFilesTask,
    WriteSubtractionFASTATask,
)
from virtool.tasks.models import Task
from virtool.utils import get_temp_dir


async def test_add_subtraction_files_task(
    config,
    data_layer,
    mongo,
    pg: AsyncEngine,
    snapshot,
    spawn_client,
    static_time,
    tmp_path,
):
    test_dir = tmp_path / "subtractions" / "foo"
    test_dir.mkdir(parents=True)
    test_dir.joinpath("subtraction.fa.gz").write_text("FASTA file")
    test_dir.joinpath("subtraction.1.bt2").write_text("Bowtie2 file")

    await mongo.subtraction.insert_one(
        {
            "_id": "foo",
            "name": "Foo",
            "nickname": "Foo Subtraction",
            "deleted": False,
        }
    )

    async with AsyncSession(pg) as session:
        session.add(
            Task(
                id=1,
                complete=False,
                context={},
                count=0,
                progress=0,
                step="rename_index_files",
                type="add_subtraction_files",
                created_at=static_time.datetime,
            )
        )

        await session.commit()

    temp_dir = get_temp_dir()

    task = AddSubtractionFilesTask(1, data_layer, {}, temp_dir)

    await task.run()

    assert sorted(os.listdir(config.data_path / "subtractions" / "foo")) == [
        "subtraction.1.bt2",
        "subtraction.fa.gz",
    ]

    async with AsyncSession(pg) as session:
        assert (
            await session.execute(select(SQLSubtractionFile))
        ).scalars().all() == snapshot


async def test_write_subtraction_fasta_file_task(
    config, data_layer, mongo, pg, snapshot, static_time, test_files_path, tmpdir
):
    subtractions_path = Path(tmpdir.mkdir("subtractions").mkdir("foo"))

    for path in (test_files_path / "index").iterdir():
        if path.name.startswith("host."):
            shutil.copy(
                path, subtractions_path / path.name.replace("host", "subtraction")
            )

    assert sorted(os.listdir(subtractions_path)) == [
        "subtraction.1.bt2",
        "subtraction.2.bt2",
        "subtraction.3.bt2",
        "subtraction.4.bt2",
        "subtraction.rev.1.bt2",
        "subtraction.rev.2.bt2",
    ]

    async with AsyncSession(pg) as session:
        session.add(
            Task(
                id=1,
                complete=False,
                context={},
                count=0,
                progress=0,
                step="write_subtraction_fasta_file",
                type="generate_fasta_file",
                created_at=static_time.datetime,
            )
        )

        await session.commit()

    task = WriteSubtractionFASTATask(
        1, data_layer, {"subtraction": "foo"}, get_temp_dir()
    )

    await task.run()

    subtraction_path = config.data_path / "subtractions" / "foo"
    assert sorted(os.listdir(config.data_path / "subtractions" / "foo")) == [
        "subtraction.1.bt2",
        "subtraction.2.bt2",
        "subtraction.3.bt2",
        "subtraction.4.bt2",
        "subtraction.fa.gz",
        "subtraction.rev.1.bt2",
        "subtraction.rev.2.bt2",
    ]

    with gzip.open(subtraction_path / "subtraction.fa.gz", "rt") as f:
        assert f.read() == snapshot
