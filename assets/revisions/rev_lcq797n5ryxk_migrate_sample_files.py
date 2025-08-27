"""migrate sample files

Revision ID: lcq797n5ryxk
Date: 2024-06-07 17:11:53.878606

"""

from asyncio import to_thread
from pathlib import Path

import arrow
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from virtool.migration import MigrationContext
from virtool.types import Document
from virtool.utils import compress_file, file_stats

# Revision identifiers.
name = "migrate sample files"
created_at = arrow.get("2024-06-07 17:11:53.878606")
revision_id = "lcq797n5ryxk"

alembic_down_revision = None
virtool_down_revision = "zma2wj6b39hs"

# Change this if an Alembic revision is required to run this migration.
required_alembic_revision = None


def _check_is_compressed(sample: Document) -> bool:
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


def _check_is_legacy(sample: dict[str, Document]) -> bool:
    """Check if a sample has legacy read files.

    :param sample: the sample document
    :return: whether the sample is a legacy sample
    """
    return not any(file.get("raw", False) for file in sample["files"]) and all(
        file["name"] in {"reads_1.fastq", "reads_2.fastq"} for file in sample["files"]
    )


async def compress_sample_reads(
    data_path: Path,
    paths: list[Path],
    sample_files: dict[str, Document],
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

        target_path = data_path / "samples" / str(sample_id) / target_filename

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


async def upgrade(ctx: MigrationContext) -> None:
    async for sample in ctx.mongo.samples.find({"files": {"$exists": True}}):
        if "is_legacy" not in sample:
            sample["is_legacy"] = _check_is_legacy(sample)

        sample_path = ctx.data_path / "samples" / sample["_id"]
        paths = [sample_path / "reads_1.fastq"]
        if sample["paired"]:
            paths.append(sample_path / "reads_2.fastq")

        if not _check_is_compressed(sample):
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
                from_ = file.get("from")

                # Check if upload already exists
                upload_result = await pg_session.execute(
                    text("SELECT id FROM uploads WHERE name_on_disk = :name_on_disk"),
                    {"name_on_disk": from_["id"]},
                )
                upload_row = upload_result.first()

                if not upload_row:
                    from_size = from_.get("size")

                    if from_size is None and (ctx.data_path / "files").exists():
                        file_path = ctx.data_path / "files" / from_.get("id")
                        from_size = (
                            file_path.stat().st_size if file_path.exists() else 0
                        )

                    # Insert upload and get the ID
                    upload_insert_result = await pg_session.execute(
                        text("""
                            INSERT INTO uploads (name, name_on_disk, size, uploaded_at, removed, reserved, ready)
                            VALUES (:name, :name_on_disk, :size, :uploaded_at, :removed, :reserved, :ready)
                            RETURNING id
                        """),
                        {
                            "name": from_["name"],
                            "name_on_disk": from_["id"],
                            "size": from_size,
                            "uploaded_at": from_.get("uploaded_at"),
                            "removed": True,
                            "reserved": True,
                            "ready": False,
                        },
                    )
                    upload_id = upload_insert_result.scalar()
                else:
                    upload_id = upload_row.id

                # Insert sample reads with the upload_id
                await pg_session.execute(
                    text("""
                        INSERT INTO sample_reads (name, name_on_disk, size, sample, upload)
                        VALUES (:name, :name_on_disk, :size, :sample, :upload)
                    """),
                    {
                        "name": file["name"],
                        "name_on_disk": file["name"],
                        "size": file["size"],
                        "sample": sample_id,
                        "upload": upload_id,
                    },
                )

            await ctx.mongo.samples.update_one(
                {"_id": sample_id},
                {
                    "$set": {"is_compressed": True, "is_legacy": sample["is_legacy"]},
                    "$unset": {"files": ""},
                },
                session=mongo_session,
            )

            await pg_session.commit()

        for path in paths:
            await to_thread(path.unlink, missing_ok=True)
