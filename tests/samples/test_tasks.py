import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from virtool.samples.models import SampleReads
from virtool.samples.tasks import CompressSamplesTask, MoveSampleFilesTask
from virtool.tasks.models import Task
from virtool.uploads.models import Upload
from virtool.data.layer import DataLayer
from virtool.utils import get_temp_dir


async def test_compress_samples_task(
    mocker, dbi, pg: AsyncEngine, data_layer: DataLayer, static_time, config
):
    """
    Ensure `compress_reads` is called correctly given a samples collection.

    """
    await dbi.samples.insert_many(
        [
            {"_id": "foo", "is_legacy": True},
            {"_id": "fab", "is_legacy": False},
            {"_id": "bar", "is_legacy": True},
        ]
    )

    async with AsyncSession(pg) as session:
        task = Task(
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
            (dbi, config, {"_id": "foo", "is_legacy": True}),
            (dbi, config, {"_id": "bar", "is_legacy": True}),
        ]
    )


@pytest.mark.parametrize("legacy", [True, False])
@pytest.mark.parametrize("compressed", [True, False])
@pytest.mark.parametrize("paired", [True, False])
async def test_move_sample_files_task(
    legacy,
    compressed,
    paired,
    dbi,
    pg: AsyncEngine,
    data_layer: DataLayer,
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
            Task(
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
                await session.execute(select(SampleReads).filter_by(id=1))
            ).scalar()
            upload = (await session.execute(select(Upload).filter_by(id=1))).scalar()

        assert sample_reads in upload.reads
        assert sample_reads.upload == upload.id
