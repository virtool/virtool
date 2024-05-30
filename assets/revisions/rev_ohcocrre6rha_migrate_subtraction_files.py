"""
migrate subtraction files

Revision ID: ohcocrre6rha
Date: 2024-05-28 22:51:14.495234

"""

import asyncio
import gzip
import os
import shutil
from glob import glob
from pathlib import Path

import arrow
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from syrupy import SnapshotAssertion
from virtool_core.utils import compress_file, rm

from virtool.migration import MigrationContext
from virtool.subtractions.files import create_subtraction_files
from virtool.subtractions.models import SQLSubtractionFile
from virtool.subtractions.utils import (
    FILES,
    rename_bowtie_files,
)

# Revision identifiers.
name = "migrate subtraction files"
created_at = arrow.get("2024-05-28 22:51:14.495234")
revision_id = "ohcocrre6rha"

alembic_down_revision = None
virtool_down_revision = "io3dep44jtym"

# Change this if an Alembic revision is required to run this migration.
required_alembic_revision = None


def join_subtraction_path(data_path: Path, subtraction_id: str) -> Path:
    return data_path / "subtractions" / subtraction_id.replace(" ", "_")


def join_subtraction_index_path(data_path: Path, subtraction_id: str) -> Path:
    return join_subtraction_path(data_path, subtraction_id) / "subtraction"


async def upgrade(ctx: MigrationContext):
    async for subtraction in ctx.mongo.subtraction.find({"deleted": False}):
        path = join_subtraction_path(ctx.data_path, subtraction["_id"])

        if not glob(f"{path}/*.fa.gz"):
            await generate_fasta_file(ctx, subtraction["_id"])

        subtraction_id = subtraction["_id"]

        path = join_subtraction_path(ctx.data_path, subtraction_id)

        await rename_bowtie_files(path)

        subtraction_files = []

        for filename in sorted(await asyncio.to_thread(os.listdir, path)):
            if filename in FILES:
                async with AsyncSession(ctx.pg) as session:
                    exists = (
                        await session.execute(
                            select(SQLSubtractionFile).filter_by(
                                subtraction=subtraction_id,
                                name=filename,
                            ),
                        )
                    ).scalar()

                if not exists:
                    subtraction_files.append(filename)

        await create_subtraction_files(
            ctx.pg,
            subtraction_id,
            subtraction_files,
            path,
        )


async def generate_fasta_file(ctx: MigrationContext, subtraction_id: str):
    """Generate a FASTA file for a subtraction that has Bowtie2 index files, but no
    FASTA file.

    :param subtraction_id: the id of the subtraction

    """

    index_path = join_subtraction_index_path(ctx.data_path, subtraction_id)

    fasta_path = join_subtraction_path(ctx.data_path, subtraction_id) / "subtraction.fa"

    proc = await asyncio.create_subprocess_shell(
        f"bowtie2-inspect {index_path} > {fasta_path}",
        stdout=asyncio.subprocess.DEVNULL,
        stderr=asyncio.subprocess.PIPE,
    )

    _, stderr = await proc.communicate()

    if proc.returncode != 0:
        raise RuntimeError(f"bowtie2-inspect failed: {stderr.decode()}")

    target_path = (
        join_subtraction_path(ctx.data_path, subtraction_id) / "subtraction.fa.gz"
    )

    await asyncio.to_thread(compress_file, fasta_path, target_path)
    await asyncio.to_thread(rm, fasta_path)


async def test_upgrade(
    ctx: MigrationContext, snapshot: SnapshotAssertion, static_time, test_files_path
):
    async with ctx.pg.begin() as conn:
        await conn.run_sync(SQLSubtractionFile.metadata.create_all)
        await conn.commit()

    subtraction_path = ctx.data_path / "subtractions" / "foo"
    subtraction_path.mkdir(parents=True)

    for path in (test_files_path / "index").iterdir():
        if path.name.startswith("host."):
            shutil.copy(
                path,
                subtraction_path / path.name.replace("host", "subtraction"),
            )

    assert sorted(os.listdir(subtraction_path)) == [
        "subtraction.1.bt2",
        "subtraction.2.bt2",
        "subtraction.3.bt2",
        "subtraction.4.bt2",
        "subtraction.rev.1.bt2",
        "subtraction.rev.2.bt2",
    ]

    await ctx.mongo.subtraction.insert_one(
        {
            "_id": "foo",
            "name": "Foo",
            "deleted": False,
        },
    )

    await upgrade(ctx)

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

    async with AsyncSession(ctx.pg) as session:
        assert (
            await session.execute(select(SQLSubtractionFile))
        ).scalars().all() == snapshot
