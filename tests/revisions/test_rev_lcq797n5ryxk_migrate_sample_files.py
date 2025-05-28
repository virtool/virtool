import os

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from assets.revisions.rev_lcq797n5ryxk_migrate_sample_files import upgrade
from virtool.samples.models import SQLSampleReads
from virtool.uploads.models import SQLUpload


class TestUpgrade:
    @pytest.fixture()
    def create_files(self, ctx):
        async def func(sample):
            read_path = ctx.data_path / "samples" / sample["_id"]
            read_path.mkdir(parents=True, exist_ok=True)
            files = sample.get("files")

            if files:
                files = [files] if isinstance(files, dict) else files
                for file in files:
                    read_path.joinpath(file["name"]).write_text(file["name"])

        return func

    @pytest.fixture()
    def verify_snapshots(self, ctx, snapshot):
        async def func(sample):
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

            assert sorted(
                os.listdir(
                    ctx.data_path / "samples" / sample["_id"],
                ),
            ) == snapshot(
                name=f"{sample["_id"]}files after",
            )

        return func

    @pytest.fixture(autouse=True)
    async def setup_pg(self, ctx):
        async with ctx.pg.begin() as conn:
            await conn.run_sync(SQLSampleReads.metadata.create_all)
            await conn.run_sync(SQLUpload.metadata.create_all)
            await conn.commit()

    @staticmethod
    async def test_modern_sample(ctx, verify_snapshots, setup_pg):
        sample = {
            "_id": "modern_sample",
            "is_legacy": False,
            "paired": False,
        }

        read_path = ctx.data_path / "samples" / sample["_id"]
        read_path.mkdir(parents=True, exist_ok=True)

        await ctx.mongo.samples.insert_one(sample)

        await upgrade(ctx)

        await verify_snapshots(sample)

    @staticmethod
    async def test_unpaired_legacy(
        ctx,
        create_files,
        verify_snapshots,
    ):
        sample = {
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
        }

        await create_files(sample)

        await ctx.mongo.samples.insert_one(sample)

        await upgrade(ctx)

        await verify_snapshots(sample)

    @staticmethod
    async def test_unpaired_legacy_pre_existing_upload(
        create_files,
        ctx,
        verify_snapshots,
        static_time,
    ):
        sample = {
            "_id": "unpaired_legacy_pre_existing_upload",
            "is_legacy": True,
            "paired": False,
            "files": [
                {
                    "name": "reads_1.fastq",
                    "size": 1,
                    "raw": True,
                    "from": {
                        "id": "unpaired_legacy_pre_existing_upload.fastq",
                        "name": "unpaired_legacy_pre_existing_upload.fastq",
                        "size": 1,
                    },
                },
            ],
        }

        async with AsyncSession(ctx.pg) as session:
            session.add(
                SQLUpload(
                    name="unpaired_legacy_pre_existing_upload",
                    name_on_disk="unpaired_legacy_pre_existing_upload.fastq",
                    size=10,
                    uploaded_at=static_time.datetime,
                    removed=False,
                    reserved=True,
                ),
            )
            await session.commit()

        await create_files(sample)

        await ctx.mongo.samples.insert_one(sample)

        await upgrade(ctx)

        await verify_snapshots(sample)

    @staticmethod
    async def test_unpaired_legacy_no_from_size(
        create_files,
        ctx,
        verify_snapshots,
    ):
        sample = {
            "_id": "unpaired_legacy_no_from_size",
            "is_legacy": True,
            "paired": False,
            "files": [
                {
                    "name": "reads_1.fastq",
                    "size": 1,
                    "raw": True,
                    "from": {
                        "id": "unpaired_legacy_no_from_size.fastq",
                        "name": "unpaired_legacy_no_from_size.fastq",
                    },
                },
            ],
        }

        await create_files(sample)

        files_path = ctx.data_path / "files"
        files_path.mkdir(parents=True, exist_ok=True)
        files_path.joinpath("unpaired_legacy_no_from_size.fastq").write_text(
            "unpaired_legacy_no_from_size",
        )

        await ctx.mongo.samples.insert_one(sample)

        await upgrade(ctx)

        await verify_snapshots(sample)

    @staticmethod
    async def test_unpaired_legacy_no_from_size_unrecoverable(
        create_files,
        ctx,
        verify_snapshots,
    ):
        sample = {
            "_id": "unpaired_legacy_no_from_size_unrecoverable",
            "is_legacy": True,
            "paired": False,
            "files": [
                {
                    "name": "reads_1.fastq",
                    "size": 1,
                    "raw": True,
                    "from": {
                        "id": "unpaired_legacy_no_from_size_unrecoverable.fastq",
                        "name": "unpaired_legacy_no_from_size_unrecoverable.fastq",
                    },
                },
            ],
        }

        files_path = ctx.data_path / "files"
        files_path.mkdir(parents=True, exist_ok=True)

        await create_files(sample)

        await ctx.mongo.samples.insert_one(sample)

        await upgrade(ctx)

        await verify_snapshots(sample)

    @staticmethod
    async def test_paired_unknown_legacy(
        create_files,
        ctx,
        verify_snapshots,
    ):
        sample = {
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
        }

        await create_files(sample)

        await ctx.mongo.samples.insert_one(sample)

        await upgrade(ctx)

        await verify_snapshots(sample)

    @staticmethod
    async def test_unpaired_unknown_legacy(
        create_files,
        ctx,
        verify_snapshots,
    ):
        sample = {
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
        }

        await create_files(sample)

        await ctx.mongo.samples.insert_one(sample)

        await upgrade(ctx)

        await verify_snapshots(sample)

    @staticmethod
    async def test_unpaired_legacy_compressed(
        create_files,
        ctx,
        verify_snapshots,
    ):
        sample = {
            "_id": "unpaired_legacy_compressed",
            "paired": False,
            "is_legacy": True,
            "files": [
                {
                    "name": "reads_1.fq.gz",
                    "size": 1,
                    "raw": False,
                    "from": {
                        "id": "unpaired_legacy_compressed.fastq",
                        "name": "unpaired_legacy_compressed.fastq",
                        "size": 1,
                    },
                },
            ],
        }

        await create_files(sample)

        await ctx.mongo.samples.insert_one(sample)

        await upgrade(ctx)

        await verify_snapshots(sample)

    @staticmethod
    async def test_unpaired_legacy_partial_compression(
        create_files,
        ctx,
        verify_snapshots,
    ):
        sample = {
            "_id": "unpaired_legacy_partial_compression",
            "paired": False,
            "files": [
                {
                    "name": "reads_1.fastq",
                    "size": 1,
                    "raw": False,
                    "from": {
                        "id": "unpaired_legacy_partial_compression.fastq",
                        "name": "unpaired_legacy_partial_compression.fastq",
                        "size": 1,
                    },
                },
            ],
        }

        await create_files(sample)

        (ctx.data_path / "samples" / sample["_id"] / "reads_1.fq.gz").write_text(
            sample["_id"],
        )

        await ctx.mongo.samples.insert_one(sample)

        await upgrade(ctx)

        await verify_snapshots(sample)
