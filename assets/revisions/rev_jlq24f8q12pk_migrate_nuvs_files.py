"""
migrate nuvs files

Revision ID: jlq24f8q12pk
Date: 2024-05-31 20:25:49.413590

"""

import asyncio
import os
import shutil

import arrow
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from virtool_core.utils import compress_file

from virtool.analyses.files import create_nuvs_analysis_files
from virtool.analyses.models import SQLAnalysisFile
from virtool.migration import MigrationContext

# Revision identifiers.
name = "migrate nuvs files"
created_at = arrow.get("2024-05-31 20:25:49.413590")
revision_id = "jlq24f8q12pk"

alembic_down_revision = None
virtool_down_revision = "t05gnq2g81qz"

# Change this if an Alembic revision is required to run this migration.
required_alembic_revision = None


async def upgrade(ctx: MigrationContext):
    async for analysis in ctx.mongo.analyses.find({"workflow": "nuvs"}):
        analysis_id = analysis["_id"]
        sample_id = analysis["sample"]["id"]

        old_path = ctx.data_path / "samples" / sample_id / "analysis" / analysis_id
        target_path = ctx.data_path / "analyses" / analysis_id

        async with AsyncSession(ctx.pg) as session:
            exists = (
                await session.execute(
                    select(SQLAnalysisFile).filter_by(analysis=analysis_id),
                )
            ).scalar()

        if await asyncio.to_thread(old_path.is_dir) and not exists:
            await asyncio.to_thread(target_path.mkdir, exist_ok=True, parents=True)

            analysis_files = []

            for filename in sorted(os.listdir(old_path)):
                if filename in (
                    "hmm.tsv",
                    "assembly.fa",
                    "orfs.fa",
                    "unmapped_hosts.fq",
                    "unmapped_otus.fq",
                ):
                    analysis_files.append(filename)

                    if filename == "hmm.tsv":
                        await asyncio.to_thread(
                            shutil.copy, old_path / "hmm.tsv", target_path / "hmm.tsv"
                        )
                    else:
                        await asyncio.to_thread(
                            compress_file,
                            old_path / filename,
                            target_path / f"{filename}.gz",
                        )

            await create_nuvs_analysis_files(
                ctx.pg,
                analysis_id,
                analysis_files,
                target_path,
            )


async def test_upgrade(ctx, snapshot):
    async with ctx.pg.begin() as conn:
        await conn.run_sync(SQLAnalysisFile.metadata.create_all)
        await conn.commit()

    analysis_path = ctx.data_path / "samples" / "foo" / "analysis" / "bar"
    analysis_path.mkdir(parents=True, exist_ok=True)
    analysis_path.joinpath("assembly.fa").write_text("FASTA file")
    analysis_path.joinpath("hmm.tsv").write_text("HMM file")
    analysis_path.joinpath("unmapped_otus.fq").write_text("FASTQ file")

    await ctx.mongo.analyses.insert_one(
        {"_id": "bar", "workflow": "nuvs", "sample": {"id": "foo"}}
    )

    await upgrade(ctx)

    assert {path.name for path in (ctx.data_path / "analyses" / "bar").iterdir()} == {
        "assembly.fa.gz",
        "hmm.tsv",
        "unmapped_otus.fq.gz",
    }

    async with AsyncSession(ctx.pg) as session:
        assert (
            await session.execute(select(SQLAnalysisFile))
        ).scalars().all() == snapshot
