import gzip
import os
import shutil
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from syrupy import SnapshotAssertion

from virtool.data.layer import DataLayer
from virtool.mongo.core import Mongo
from virtool.subtractions.models import SQLSubtractionFile
from virtool.subtractions.tasks import (
    AddSubtractionFilesTask,
    CheckSubtractionsFASTATask,
)
from virtool.tasks.models import SQLTask
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
            SQLTask(
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


async def test_check_subtraction_fasta_file_task(
    config,
    data_layer: DataLayer,
    mongo: Mongo,
    pg: AsyncEngine,
    snapshot: SnapshotAssertion,
    static_time,
    test_files_path: Path,
    tmpdir,
):
    subtractions_path = Path(tmpdir.mkdir("subtractions"))
    subtraction_path = subtractions_path / "foo"
    subtraction_path.mkdir()

    for path in (test_files_path / "index").iterdir():
        if path.name.startswith("host."):
            shutil.copy(
                path, subtraction_path / path.name.replace("host", "subtraction")
            )

    assert sorted(os.listdir(subtraction_path)) == [
        "subtraction.1.bt2",
        "subtraction.2.bt2",
        "subtraction.3.bt2",
        "subtraction.4.bt2",
        "subtraction.rev.1.bt2",
        "subtraction.rev.2.bt2",
    ]

    await mongo.subtraction.insert_one(
        {
            "_id": "foo",
            "name": "Foo",
            "deleted": False,
        }
    )

    async with AsyncSession(pg) as session:
        session.add(
            SQLTask(
                id=1,
                complete=False,
                context={},
                count=0,
                progress=0,
                step="check_subtractions_fasta_files",
                type="check_subtractions_fasta_files",
                created_at=static_time.datetime,
            )
        )

        await session.commit()

    task = CheckSubtractionsFASTATask(
        1, data_layer, {"subtraction": "foo"}, get_temp_dir()
    )

    await task.run()

    assert task.errored is False

    assert sorted(os.listdir(subtraction_path)) == [
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
