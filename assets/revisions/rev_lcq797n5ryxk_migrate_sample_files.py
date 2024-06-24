"""migrate sample files

Revision ID: lcq797n5ryxk
Date: 2024-06-07 17:11:53.878606

"""

import os
from asyncio import to_thread
from pathlib import Path

import arrow
from motor.motor_asyncio import AsyncIOMotorDatabase
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from virtool_core.utils import compress_file, file_stats

from virtool.migration import MigrationContext
from virtool.samples.models import SQLSampleReads
from virtool.uploads.models import SQLUpload

# Revision identifiers.
name = "migrate sample files"
created_at = arrow.get("2024-06-07 17:11:53.878606")
revision_id = "lcq797n5ryxk"

alembic_down_revision = None
virtool_down_revision = "zma2wj6b39hs"

# Change this if an Alembic revision is required to run this migration.
required_alembic_revision = None


def check_is_legacy(sample: dict[str, any]) -> bool:
    """Check if a sample has legacy read files.

    :param sample: the sample document
    :return: whether the sample is a legacy sample
    """
    files = sample.get("files")

    return (
        all(file.get("raw", False) is False for file in files)
        and files[0]["name"] == "reads_1.fastq"
        and (sample["paired"] is False or files[1]["name"] == "reads_2.fastq")
    )


def check_is_compressed(sample: dict[str, any]) -> bool:
    """Check if a sample has compressed read files.

    :param sample: the sample document
    :return: whether the sample read files are compressed
    """
    files = sample.get("files")

    if not files or not sample.get("is_legacy") or sample.get("is_compressed"):
        return True

    names = [file["name"] for file in files]

    return all(name in {"reads_1.fq.gz", "reads_2.fq.gz"} for name in names)


def join_legacy_read_paths(data_path: Path, paired: bool, sample_id: int):
    """Create a list of paths for the read files associated with the `sample`.

    :param data_path: the location of the data directory
    :param paired: whether paired or single end reads are used
    :param sample_id: the unique identifier of the sample
    :return: a list of sample read paths
    """
    sample_path = data_path / "samples" / sample_id

    if paired:
        return [
            sample_path / "reads_1.fastq",
            sample_path / "reads_2.fastq",
        ]

    return [sample_path / "reads_1.fastq"]


async def compress_sample_reads(
    db: AsyncIOMotorDatabase,
    data_path: Path,
    sample_files: dict[str, any],
    paired: bool,
    sample_id: int,
):
    """Compress the reads for one legacy samples.

    :param db: the application database object
    :param data_path: the location of the data directory
    :param files: the read files to be compressed
    :param paired: whether paired or single end reads are used
    :param sample_id: the unique identifier of the sample

    """
    paths = join_legacy_read_paths(data_path, paired, sample_id)

    files = []

    for i, path in enumerate(paths):
        target_filename = (
            "reads_1.fq.gz" if "reads_1.fastq" in str(path) else "reads_2.fq.gz"
        )

        target_path = data_path / "samples" / sample_id / target_filename

        await to_thread(compress_file, path, target_path, 1)

        stats = await to_thread(file_stats, target_path)

        files.append(
            {
                "name": target_filename,
                "download_url": f"/download/samples/{sample_id}/{target_filename}",
                "size": stats["size"],
                "raw": False,
                "from": sample_files[i]["from"],
            },
        )

    await db.samples.update_one(
        {"_id": sample_id},
        {"$set": {"files": files, "is_compressed": True}},
    )

    for path in paths:
        await to_thread(os.remove, path)

    return files


async def upgrade(ctx: MigrationContext):
    async for sample in ctx.mongo.samples.find({"files": {"$exists": True}}):
        files = sample["files"]
        sample["files"] = [files] if isinstance(files, dict) else files

        if "is_legacy" not in sample:
            sample["is_legacy"] = check_is_legacy(sample)
            ctx.mongo.samples.update_one(
                {"_id": sample["_id"]},
                {"$set": {"is_legacy": sample["is_legacy"]}},
            )

        if not check_is_compressed(sample):
            sample["files"] = await compress_sample_reads(
                ctx.mongo,
                ctx.data_path,
                sample["files"],
                sample["paired"],
                sample["_id"],
            )

        async with AsyncSession(
            ctx.pg,
        ) as pg_session, await (
            ctx.mongo.client.start_session()
        ) as mongo_session, mongo_session.start_transaction():
            sample_id = sample["_id"]
            for file in sample["files"]:
                from_ = file.get("from")
                print("file", file)
                upload = SQLUpload(
                    name=from_["name"],
                    name_on_disk=from_["id"],
                    size=from_["size"],
                    uploaded_at=from_.get("uploaded_at"),
                    removed=True,
                    reserved=True,
                )

                reads = SQLSampleReads(
                    name=file["name"],
                    name_on_disk=file["name"],
                    size=file["size"],
                    sample=sample_id,
                )

                upload.reads.append(reads)

                pg_session.add_all([upload, reads])

            await ctx.mongo.samples.update_one(
                {"_id": sample_id},
                {"$unset": {"files": ""}},
                session=mongo_session,
            )

            await pg_session.commit()


async def test_upgrade(ctx, snapshot):
    async with ctx.pg.begin() as conn:
        await conn.run_sync(SQLSampleReads.metadata.create_all)
        await conn.run_sync(SQLUpload.metadata.create_all)
        await conn.commit()

    samples = [
        {
            "_id": "modern_sample",
            "is_legacy": False,
            "paired": False,
        },
        {
            "_id": "unpaired_legacy",
            "is_legacy": True,
            "paired": False,
            "files": [
                {
                    "name": "reads_1.fastq",
                    "size": 1,
                    "raw": True,
                    "from": {
                        "id": "unpaired_legacy.fastq",
                        "name": "unpaired_legacy.fastq",
                        "size": 1,
                    },
                },
            ],
        },
        {
            "_id": "paired_unknown_legacy",
            "paired": True,
            "files": [
                {
                    "name": "reads_1.fastq",
                    "size": 1,
                    "raw": False,
                    "from": {
                        "id": "paired_unknown_legacy.fastq",
                        "name": "paired_unknown_legacy.fastq",
                        "size": 1,
                    },
                },
                {
                    "name": "reads_2.fastq",
                    "size": 1,
                    "raw": False,
                    "from": {
                        "id": "paired_unknown_legacy_2.fastq",
                        "name": "paired_unknown_legacy_2.fastq",
                        "size": 1,
                    },
                },
            ],
        },
        {
            "_id": "unpaired_unknown_legacy",
            "paired": False,
            "files": [
                {
                    "name": "reads_1.fastq",
                    "size": 1,
                    "raw": False,
                    "from": {
                        "id": "unpaired_unknown_legacy.fastq",
                        "name": "unpaired_unknown_legacy.fastq",
                        "size": 1,
                    },
                },
            ],
        },
        {
            "_id": "unpaired_legacy_compressed",
            "paired": False,
            "is_legacy": True,
            "files": [
                {
                    "name": "reads_1.fq.gz",
                    "size": 1,
                    "raw": False,
                    "from": {
                        "id": "unpaired_unknown_legacy_compressed.fastq",
                        "name": "unpaired_unknown_legacy_compressed.fastq",
                        "size": 1,
                    },
                },
            ],
        },
        {
            "_id": "unpaired_unknown_legacy_file_object",
            "paired": False,
            "files": {
                "name": "reads_1.fastq",
                "size": 1,
                "raw": False,
                "from": {
                    "id": "unpaired_unknown_legacy_file_object.fastq",
                    "name": "unpaired_unknown_legacy_file_object.fastq",
                    "size": 1,
                },
            },
        },
        {
            "_id": "unpaired_legacy_partial_compression",
            "paired": False,
            "files": {
                "name": "reads_1.fastq",
                "size": 1,
                "raw": False,
                "from": {
                    "id": "unpaired_legacy_partial_compression.fastq",
                    "name": "unpaired_legacy_partial_compression.fastq",
                    "size": 1,
                },
            },
        },
    ]

    for sample in samples:
        read_path = ctx.data_path / "samples" / sample["_id"]
        read_path.mkdir(parents=True, exist_ok=True)
        files = sample.get("files")

        if files:
            files = [files] if isinstance(files, dict) else files
            for file in files:
                read_path.joinpath(file["name"]).write_text(file["name"])

    (
        ctx.data_path
        / "samples"
        / "unpaired_legacy_partial_compression"
        / "reads_1.fq.gz"
    ).write_text("unpaired_legacy_partial_compression")

    await ctx.mongo.samples.insert_many(samples)

    await upgrade(ctx)

    assert [sample async for sample in ctx.mongo.samples.find({})] == snapshot(
        name="mongo_after",
    )

    async with AsyncSession(ctx.pg) as session:
        assert (
            await session.execute(select(SQLUpload))
        ).unique().scalars().all() == snapshot(name="SQLUploads after")
        assert (
            await session.execute(select(SQLSampleReads))
        ).scalars().all() == snapshot(name="SQLSampleReads after")

    for sample in samples:
        assert os.listdir(ctx.data_path / "samples" / sample["_id"]) == snapshot(
            name=f"{sample["_id"]}files after",
        )
