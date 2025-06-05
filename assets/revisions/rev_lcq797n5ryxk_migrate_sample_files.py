"""migrate sample files

Revision ID: lcq797n5ryxk
Date: 2024-06-07 17:11:53.878606

"""

from asyncio import to_thread
from pathlib import Path

import arrow
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from virtool_core.utils import compress_file, file_stats

from virtool.migration import MigrationContext
from virtool.samples.sql import SQLSampleReads
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
    return not any(file.get("raw", False) for file in sample["files"]) and all(
        file["name"] in {"reads_1.fastq", "reads_2.fastq"} for file in sample["files"]
    )


def check_is_compressed(sample: dict[str, any]) -> bool:
    """Check if a sample has compressed read files.

    :param sample: the sample document
    :return: whether the sample read files are compressed
    """
    return (
        not sample.get("is_legacy")
        or sample.get("is_compressed")
        or all(
            file["name"] in {"reads_1.fq.gz", "reads_2.fq.gz"}
            for file in sample["files"]
        )
    )


async def compress_sample_reads(
    data_path: Path,
    paths: list[Path],
    sample_files: dict[str, any],
    sample_id: int,
):
    """Compress the reads for one legacy samples.

    :param mongo: the application database object
    :param data_path: the location of the data directory
    :param files: the read files to be compressed
    :param paired: whether paired or single end reads are used
    :param sample_id: the unique identifier of the sample

    :return: a list of the compressed read files
    """
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

    return files


async def upgrade(ctx: MigrationContext):
    async for sample in ctx.mongo.samples.find({"files": {"$exists": True}}):
        if "is_legacy" not in sample:
            sample["is_legacy"] = check_is_legacy(sample)

        sample_path = ctx.data_path / "samples" / sample["_id"]
        paths = [sample_path / "reads_1.fastq"]
        if sample["paired"]:
            paths.append(sample_path / "reads_2.fastq")

        if not check_is_compressed(sample):
            sample["files"] = await compress_sample_reads(
                ctx.data_path,
                paths,
                sample["files"],
                sample["_id"],
            )

        async with (
            AsyncSession(
                ctx.pg,
            ) as pg_session,
            await ctx.mongo.client.start_session() as mongo_session,
            mongo_session.start_transaction(),
        ):
            sample_id = sample["_id"]
            for file in sample["files"]:
                reads = SQLSampleReads(
                    name=file["name"],
                    name_on_disk=file["name"],
                    size=file["size"],
                    sample=sample_id,
                )

                from_ = file.get("from")

                upload = (
                    (
                        await pg_session.scalars(
                            select(SQLUpload).where(
                                SQLUpload.name_on_disk == from_["id"],
                            ),
                        )
                    )
                    .unique()
                    .one_or_none()
                )

                if not upload:
                    from_size = from_.get("size")
                    if from_size is None and (ctx.data_path / "files").exists():
                        file_path = ctx.data_path / "files" / from_.get("id")
                        from_size = (
                            file_path.stat().st_size if file_path.exists() else 0
                        )

                    upload = SQLUpload(
                        name=from_["name"],
                        name_on_disk=from_["id"],
                        size=from_size,
                        uploaded_at=from_.get("uploaded_at"),
                        removed=True,
                        reserved=True,
                    )

                upload.reads.append(reads)

                pg_session.add_all([reads, upload])

            await ctx.mongo.samples.update_one(
                {"_id": sample_id},
                {
                    "$unset": {"files": ""},
                    "$set": {"is_compressed": True, "is_legacy": sample["is_legacy"]},
                },
                session=mongo_session,
            )

            await pg_session.commit()

        for path in paths:
            await to_thread(path.unlink, missing_ok=True)
