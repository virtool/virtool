"""ensure index files

Revision ID: 0p3nhjg1fcfj
Date: 2024-05-22 20:47:09.866326

"""

import gzip
from asyncio import gather
from pathlib import Path

import arrow
import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from assets.revisions.rev_0p3nhjg1fcfj_ensure_index_files import upgrade
from virtool.indexes.sql import IndexType, SQLIndexFile
from virtool.migration import MigrationContext

# Revision identifiers.
name = "ensure index files"
created_at = arrow.get("2024-05-22 20:47:09.866326")
revision_id = "0p3nhjg1fcfj"

alembic_down_revision = None
virtool_down_revision = "ulapmx8i3vpg"


# Change this if an Alembic revision is required to run this migration.
required_alembic_revision = None


def _get_index_file_type_from_name(file_name: str) -> IndexType:
    if ".json" in file_name:
        return IndexType.json

    if ".fa" in file_name:
        return IndexType.fasta

    if ".bt" in file_name:
        return IndexType.bowtie2

    raise ValueError(f"Filename does not map to valid IndexType: {file_name}")


class TestUpgrade:
    """Test that SQLFiles are create as is appropriate for indexes.

    - Files exist and have been added to SQL
    - Files exist but have not been added to SQL
    - Files do not exist

    Also, ensures that an index JSON file is generated if missing.
    """

    @staticmethod
    @pytest.mark.parametrize(
        "previously_upgraded",
        [
            True,
            False,
        ],
    )
    async def test_upgrade(
        ctx: MigrationContext,
        snapshot,
        previously_upgraded,
        create_task_index,
    ):
        async with ctx.pg.begin() as conn:
            await conn.run_sync(SQLIndexFile.metadata.create_all)
            await conn.commit()

        task_index = await create_task_index(ctx)

        test_dir = (
            ctx.data_path / "references" / task_index["reference"]["id"] / "index_1"
        )

        test_dir.joinpath("reference.fa.gz").write_text("FASTA file")
        test_dir.joinpath("reference.1.bt2").write_text("Bowtie2 file")

        if previously_upgraded:
            with gzip.open(test_dir / "reference.json.gz", "wt") as file:
                file.write("Complete index json")

            async with AsyncSession(ctx.pg) as session:
                session.add_all(
                    [
                        SQLIndexFile(
                            name=f"previously upgraded {path.name}",
                            index="index_1",
                            type=_get_index_file_type_from_name(path.name),
                            size=5,
                        )
                        for path in sorted(test_dir.iterdir())
                    ],
                )
                await session.commit()

        await upgrade(ctx)

        async with AsyncSession(ctx.pg) as session:
            assert (
                await session.execute(select(SQLIndexFile))
            ).scalars().all() == snapshot

        with gzip.open(Path(test_dir) / "reference.json.gz", "rt") as f:
            assert f.read() == snapshot(name="json")

    @staticmethod
    async def test_upgrade_no_files(
        ctx: MigrationContext,
        snapshot,
        create_task_index,
    ):
        async with ctx.pg.begin() as conn:
            await conn.run_sync(SQLIndexFile.metadata.create_all)
            await conn.commit()

        task_index = await create_task_index(ctx)

        await ctx.mongo.indexes.update_one(
            {"_id": "index_1"},
            {"$unset": {"manifest": ""}},
        )

        test_dir = (
            ctx.data_path / "references" / task_index["reference"]["id"] / "index_1"
        )
        test_dir.rmdir()

        await upgrade(ctx)

        async with AsyncSession(ctx.pg) as session:
            assert (
                await session.execute(select(SQLIndexFile))
            ).scalars().all() == snapshot

        with (
            pytest.raises(FileNotFoundError),
            gzip.open(Path(test_dir) / "reference.json.gz", "rt") as f,
        ):
            f.read()

    @staticmethod
    async def test_upgrade_not_ready(
        ctx: MigrationContext,
        snapshot,
        create_task_index,
    ):
        async with ctx.pg.begin() as conn:
            await conn.run_sync(SQLIndexFile.metadata.create_all)
            await conn.commit()

        task_index = await create_task_index(ctx)

        await ctx.mongo.indexes.update_one(
            {"_id": "index_1"},
            {"$set": {"ready": False}},
        )

        await upgrade(ctx)

        async with AsyncSession(ctx.pg) as session:
            assert (
                await session.execute(select(SQLIndexFile))
            ).scalars().all() == snapshot

        with (
            pytest.raises(FileNotFoundError),
            gzip.open(
                Path(
                    ctx.data_path
                    / "references"
                    / task_index["reference"]["id"]
                    / "index_1",
                )
                / "reference.json.gz",
                "rt",
            ) as f,
        ):
            f.read()


@pytest.fixture()
async def create_task_index(
    config,
    reference,
    test_otu,
    test_sequence,
):
    async def func(ctx: MigrationContext):
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

        await gather(
            ctx.mongo.otus.insert_one(test_otu),
            ctx.mongo.sequences.insert_one(test_sequence),
            ctx.mongo.references.insert_one({**reference, "_id": ref_id}),
            ctx.mongo.indexes.insert_one(index),
        )

        index_dir = config.data_path / "references" / ref_id / index["_id"]
        index_dir.mkdir(parents=True)

        return index

    return func
