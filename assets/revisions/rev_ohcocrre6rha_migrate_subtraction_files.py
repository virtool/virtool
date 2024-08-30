"""migrate subtraction files

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
import pytest
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


async def ensure_subtraction_folder_name(
    ctx: MigrationContext,
    subtraction_id: str,
) -> None:
    """Update the name of the subtraction directory to match the casing of the ID.

    :param ctx: the migration context
    :param subtraction_id: the id of the subtraction
    """
    path = join_subtraction_path(ctx.data_path, subtraction_id)

    if path.is_dir():
        return

    lowercase_id = subtraction_id.lower()

    # Ensure that there is no existing subtraction that matches the lowercase id
    if await ctx.mongo.subtraction.find_one({"_id": lowercase_id}):
        raise ValueError(
            f"File name conflict, {lowercase_id} already exists in the database",
        )

    lowercase_path = path.with_name(lowercase_id.replace(" ", "_"))
    if not lowercase_path.is_dir():
        raise FileNotFoundError(f"Subtraction directory not found: {lowercase_path}")

    lowercase_path.rename(path)


async def upgrade(ctx: MigrationContext):
    async for subtraction in ctx.mongo.subtraction.find({"deleted": False}):
        subtraction_id = subtraction["_id"]
        path = join_subtraction_path(ctx.data_path, subtraction_id)

        await ensure_subtraction_folder_name(ctx, subtraction_id)

        await rename_bowtie_files(path)

        if not glob(f"{path}/*.fa.gz"):
            await generate_fasta_file(ctx.data_path, subtraction_id)

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


async def generate_fasta_file(data_path: Path, subtraction_id: str):
    """Generate a FASTA file for a subtraction that has Bowtie2 index files, but no
    FASTA file.

    :param data_path: the path to the data directory
    :param subtraction_id: the id of the subtraction
    """
    index_path = join_subtraction_index_path(data_path, subtraction_id)

    fasta_path = join_subtraction_path(data_path, subtraction_id) / "subtraction.fa"

    proc = await asyncio.create_subprocess_shell(
        f"bowtie2-inspect {index_path} > {fasta_path}",
        stdout=asyncio.subprocess.DEVNULL,
        stderr=asyncio.subprocess.PIPE,
    )

    _, stderr = await proc.communicate()

    if proc.returncode != 0:
        raise RuntimeError(f"bowtie2-inspect failed: {stderr.decode()}")

    target_path = join_subtraction_path(data_path, subtraction_id) / "subtraction.fa.gz"

    await asyncio.to_thread(compress_file, fasta_path, target_path)
    await asyncio.to_thread(rm, fasta_path)


async def test_upgrade(
    ctx: MigrationContext,
    snapshot: SnapshotAssertion,
    test_files_path,
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


class TestEnsureSubtractionFileName:
    @staticmethod
    async def test_ensure_subtraction_file_name(
        ctx: MigrationContext,
        snapshot: SnapshotAssertion,
    ):
        subtraction_path = ctx.data_path / "subtractions" / "foo_bar"
        subtraction_path.mkdir(parents=True)
        (subtraction_path / "foo.txt").write_text("foo")

        await ensure_subtraction_folder_name(ctx, "Foo Bar")

        updated_path = ctx.data_path / "subtractions" / "Foo_Bar"
        assert updated_path.is_dir()
        assert [file.name for file in updated_path.iterdir()] == snapshot

    @staticmethod
    async def test_ensure_subtraction_file_name_has_conflict(ctx):
        subtraction_path = ctx.data_path / "subtractions" / "foo"
        subtraction_path.mkdir(parents=True)

        await ctx.mongo.subtraction.insert_one(
            {
                "_id": "foo",
                "name": "foo",
                "deleted": False,
            },
        )
        with pytest.raises(ValueError):
            await ensure_subtraction_folder_name(ctx, "Foo")

    @staticmethod
    async def test_ensure_subtraction_file_name_no_file(ctx):
        with pytest.raises(FileNotFoundError):
            await ensure_subtraction_folder_name(ctx, "Foo")
