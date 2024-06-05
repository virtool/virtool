import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.data.layer import DataLayer
from virtool.samples.models import SQLSampleReads
from virtool.samples.tasks import (
    CompressSamplesTask,
    MoveSampleFilesTask,
    UpdateSampleWorkflowsTask,
)
from virtool.tasks.models import SQLTask
from virtool.uploads.models import SQLUpload
from virtool.utils import get_temp_dir


async def test_compress_samples_task(
    mocker, mongo, pg: AsyncEngine, data_layer: DataLayer, static_time, config
):
    """
    Ensure `compress_reads` is called correctly given a samples collection.

    """
    await mongo.samples.insert_many(
        [
            {"_id": "foo", "is_legacy": True},
            {"_id": "fab", "is_legacy": False},
            {"_id": "bar", "is_legacy": True},
        ],
        session=None,
    )

    async with AsyncSession(pg) as session:
        task = SQLTask(
            id=1,
            complete=False,
            context={},
            count=0,
            progress=0,
            step="rename_index_files",
            type="add_subtraction_files",
            created_at=static_time.datetime,
        )
        session.add(task)
        await session.commit()

    calls = []

    async def compress_reads(db, app_config, sample):
        calls.append((db, app_config, sample))

        # Set is_compressed on the sample as would be expected after a successful compression
        await db.samples.update_one(
            {"_id": sample["_id"]}, {"$set": {"is_compressed": True}}
        )

    mocker.patch("virtool.samples.db.compress_sample_reads", compress_reads)

    task = CompressSamplesTask(1, data_layer, {}, get_temp_dir())

    await task.run()

    assert calls == (
        [
            (mongo, config, {"_id": "foo", "is_legacy": True}),
            (mongo, config, {"_id": "bar", "is_legacy": True}),
        ]
    )


@pytest.mark.parametrize("legacy", [True, False])
@pytest.mark.parametrize("compressed", [True, False])
@pytest.mark.parametrize("paired", [True, False])
async def test_move_sample_files_task(
    legacy,
    compressed,
    data_layer: DataLayer,
    mongo,
    paired,
    pg: AsyncEngine,
    snapshot,
    static_time,
):
    sample = {
        "_id": "foo",
        "is_legacy": legacy,
        "is_compressed": compressed,
        "files": [
            {
                "download_url": "/download/samples/oictwh/reads_1.fq.gz",
                "name": "reads_1.fq.gz",
                "raw": True,
                "size": 213889231,
                "from": {
                    "id": "vorbsrmz-17TFP120_S21_R1_001.fastq.gz",
                    "name": "vorbsrmz-17TFP120_S21_R1_001.fastq.gz",
                    "size": 239801249712,
                    "uploaded_at": None,
                },
            }
        ],
    }

    if paired:
        sample["files"].append(
            {
                "download_url": "/download/samples/oictwh/reads_2.fq.gz",
                "name": "reads_2.fq.gz",
                "raw": True,
                "size": 213889231,
                "from": {
                    "id": "vorbsrmz-17TFP120_S21_R1_002.fastq.gz",
                    "name": "vorbsrmz-17TFP120_S21_R1_002.fastq.gz",
                    "size": 239801249712,
                    "uploaded_at": None,
                },
            }
        )

    await mongo.samples.insert_one(sample)

    async with AsyncSession(pg) as session:
        session.add(
            SQLTask(
                id=1,
                complete=False,
                context={},
                count=0,
                progress=0,
                step="move_sample_files",
                type="migrate_files",
                created_at=static_time.datetime,
            )
        )
        await session.commit()

    task = MoveSampleFilesTask(1, data_layer, {}, get_temp_dir())

    await task.run()

    assert await mongo.samples.find_one({"_id": "foo"}) == snapshot

    if not legacy or (legacy and compressed):
        async with AsyncSession(pg) as session:
            sample_reads = (
                await session.execute(select(SQLSampleReads).filter_by(id=1))
            ).scalar()
            upload = (await session.execute(select(SQLUpload).filter_by(id=1))).scalar()

        assert sample_reads in upload.reads
        assert sample_reads.upload == upload.id


@pytest.mark.parametrize("ready", [True, False])
async def test_update_workflows_fields(
    data_layer: DataLayer,
    mongo,
    pg: AsyncEngine,
    ready,
    static_time,
    snapshot,
):
    await mongo.samples.insert_one(
        {
            "_id": "test_id",
            "library_type": "normal",
            "nuvs": False,
            "pathoscope": True,
            "workflows": {
                "aodp": "incompatible",
                "nuvs": "none",
                "pathoscope": "none",
            },
        },
        session=None,
    )

    await mongo.analyses.insert_many(
        [
            {
                "_id": "test",
                "sample": {"id": "test_id"},
                "ready": ready,
                "workflow": "pathoscope_bowtie",
            },
            {
                "_id": "test1",
                "sample": {"id": "test_id"},
                "ready": False,
                "workflow": "nuvs",
            },
        ],
        session=None,
    )

    async with AsyncSession(pg) as session:
        session.add(
            SQLTask(
                id=1,
                complete=False,
                context={},
                count=0,
                progress=0,
                step="populate_workflows_field",
                type="populate_workflows_field",
                created_at=static_time.datetime,
            )
        )
        await session.commit()

    task = UpdateSampleWorkflowsTask(1, data_layer, {}, get_temp_dir())

    await task.run()

    assert await mongo.samples.find().to_list(None) == snapshot
