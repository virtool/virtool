import gzip
import os
import shutil

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from syrupy import SnapshotAssertion

from assets.revisions.rev_ohcocrre6rha_migrate_subtraction_files import (
    ensure_subtraction_folder_name,
    upgrade,
)
from virtool.migration import MigrationContext
from virtool.subtractions.models import SQLSubtractionFile


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
