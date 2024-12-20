"""migrate nuvs files

Revision ID: jlq24f8q12pk
Date: 2024-05-31 20:25:49.413590

"""

import asyncio
import os
import shutil

import arrow
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from virtool_core.utils import compress_file, file_stats

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
    analysis_list = [
        (analysis["_id"], analysis["sample"]["id"])
        async for analysis in ctx.mongo.analyses.find(
            {"workflow": "nuvs"},
            projection={"sample": 1},
        )
    ]

    for analysis_id, sample_id in analysis_list:
        source_path = ctx.data_path / "samples" / sample_id / "analysis" / analysis_id
        target_path = ctx.data_path / "analyses" / analysis_id

        async with AsyncSession(ctx.pg) as session:
            exists = (
                await session.execute(
                    select(SQLAnalysisFile).filter_by(analysis=analysis_id),
                )
            ).scalar()

        if await asyncio.to_thread(source_path.is_dir) and not exists:
            await asyncio.to_thread(target_path.mkdir, exist_ok=True, parents=True)

            analysis_files = []

            for filename in sorted(os.listdir(source_path)):
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
                            shutil.copy,
                            source_path / "hmm.tsv",
                            target_path / "hmm.tsv",
                        )
                    else:
                        await asyncio.to_thread(
                            compress_file,
                            source_path / filename,
                            target_path / f"{filename}.gz",
                        )

            sql_analysis_files = []

            for filename in analysis_files:
                file_type = check_nuvs_file_type(filename)

                if not filename.endswith(".tsv"):
                    filename += ".gz"

                size = (await asyncio.to_thread(file_stats, target_path / filename))[
                    "size"
                ]

                sql_analysis_files.append(
                    SQLAnalysisFile(
                        name=filename,
                        analysis=analysis_id,
                        format=file_type,
                        size=size,
                    ),
                )

            async with AsyncSession(ctx.pg) as session:
                session.add_all(sql_analysis_files)

                await session.flush()

                for analysis_file in sql_analysis_files:
                    analysis_file.name_on_disk = (
                        f"{analysis_file.id}-{analysis_file.name}"
                    )

                await session.commit()


def check_nuvs_file_type(file_name: str) -> str:
    """Get the NuVs analysis file type based on the extension of given `file_name`

    :param file_name: NuVs analysis file name
    :return: file type
    """
    if file_name.endswith(".tsv"):
        return "tsv"

    if file_name.endswith(".fa"):
        return "fasta"

    if file_name.endswith(".fq"):
        return "fastq"

    raise ValueError("Filename has unrecognized extension")
