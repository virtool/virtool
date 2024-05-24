import asyncio
import gzip
from pathlib import Path

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.data.layer import DataLayer
from virtool.indexes.models import SQLIndexFile
from virtool.indexes.tasks import EnsureIndexFilesTask
from virtool.mongo.core import Mongo
from virtool.tasks.models import SQLTask
from virtool.utils import get_temp_dir


@pytest.fixture()
async def task_index(data_path: Path, mongo: Mongo, reference, test_otu, test_sequence):
    test_sequence["accession"] = "KX269872"
    ref_id = test_otu["reference"]["id"]

    index = {
        "_id": "index_1",
        "name": "Index 1",
        "deleted": False,
        "manifest": {test_otu["_id"]: test_otu["version"]},
        "ready": True,
        "reference": {"id": ref_id},
    }

    await asyncio.gather(
        mongo.otus.insert_one(test_otu),
        mongo.sequences.insert_one(test_sequence),
        mongo.references.insert_one({**reference, "_id": ref_id}),
        mongo.indexes.insert_one(
            {
                "_id": "index_1",
                "name": "Index 1",
                "deleted": False,
                "manifest": {test_otu["_id"]: test_otu["version"]},
                "ready": True,
                "reference": {"id": ref_id},
            },
        ),
    )

    index_dir = data_path / "references" / ref_id / "index_1"
    index_dir.mkdir(parents=True)

    return index


@pytest.mark.parametrize("files", ["DNE", "empty", "full", "not_ready"])
async def test_ensure_index_files(
    config,
    data_layer: DataLayer,
    files,
    mongo,
    pg: AsyncEngine,
    static_time,
    snapshot,
    task_index,
    tmp_path,
):
    """Test that ``files`` field is populated for index documents in the following cases:

    - Index document has no existing "files" field
    - ``files`` field is an empty list
    - index document is ready to be populated

    Also, ensure that a index JSON file is generated if missing.

    """
    test_dir = tmp_path / "references" / task_index["reference"]["id"] / "index_1"
    test_dir.joinpath("reference.fa.gz").write_text("FASTA file")
    test_dir.joinpath("reference.1.bt2").write_text("Bowtie2 file")

    update = {}

    if files == "empty":
        update["files"] = []

    if files == "full":
        update["files"] = ["full"]

    if files == "not_ready":
        update["ready"] = False

    await mongo.indexes.update_one({"_id": "index_1"}, {"$set": {"files": update}})

    async with AsyncSession(pg) as session:
        session.add(
            SQLTask(
                id=1,
                complete=False,
                context={},
                count=0,
                progress=0,
                step="rename_index_files",
                type="add_index_files",
                created_at=static_time.datetime,
            ),
        )
        await session.commit()

    task = EnsureIndexFilesTask(1, data_layer, {}, get_temp_dir())

    await task.run()

    async with AsyncSession(pg) as session:
        assert (await session.execute(select(SQLIndexFile))).scalars().all() == snapshot

    with gzip.open(Path(test_dir) / "reference.json.gz", "rt") as f:
        assert f.read() == snapshot(name="json")
