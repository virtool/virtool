import os
from typing import Dict, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

import virtool.utils
import virtool.analyses.utils

from virtool.analyses.models import AnalysisFile


async def create_analysis_file(pg: AsyncEngine, analysis_id: str, analysis_format: str, name: str, size: int = None) \
        -> Dict[str, any]:
    """
    Create a row in the `analysis_files` SQL table that represents an analysis result file.

    :param pg: PostgreSQL AsyncEngine object
    :param analysis_id: ID that corresponds to a parent analysis
    :param analysis_format: Format of the analysis result file
    :param name: Name of the analysis result file
    :param size: Size of the analysis result file
    :return: A dictionary representation of the newly created row
    """
    async with AsyncSession(pg) as session:
        analysis_file = AnalysisFile(
            name=name,
            analysis=analysis_id,
            format=analysis_format,
            size=size
        )

        session.add(analysis_file)

        await session.flush()

        analysis_file.name_on_disk = f"{analysis_file.id}-{analysis_file.name}"

        analysis_file = analysis_file.to_dict()

        await session.commit()

        return analysis_file


async def create_nuvs_analysis_files(pg: AsyncEngine, analysis_id: str, files: list, file_path: str):
    """
    Create a row in the `analysis_files` SQL table that represents an NuVs analysis result file.

    :param pg: PostgreSQL AsyncEngine object
    :param analysis_id: ID that corresponds to a parent analysis
    :param files: a list of analysis files
    :param file_path: the path to the analysis files directory
    """
    analysis_files = list()

    for filename in files:
        file_type = virtool.analyses.utils.check_nuvs_file_type(filename)

        if not filename.endswith(".tsv"):
            filename += ".gz"

        size = virtool.utils.file_stats(os.path.join(file_path, filename))["size"]

        analysis_files.append(AnalysisFile(
            name=filename,
            analysis=analysis_id,
            format=file_type,
            size=size
        ))

    async with AsyncSession(pg) as session:
        session.add_all(analysis_files)

        await session.flush()

        for analysis_file in analysis_files:
            analysis_file.name_on_disk = f"{analysis_file.id}-{analysis_file.name}"

        await session.commit()


async def delete_analysis_file(pg: AsyncEngine, file_id: int):
    """
    Deletes a row in the `analysis_files` SQL by its row `id`

    :param pg: PostgreSQL AsyncEngine object
    :param file_id: Row `id` to delete
    """
    async with AsyncSession(pg) as session:
        analysis_file = (await session.execute(select(AnalysisFile).where(AnalysisFile.id == file_id))).scalar()

        if not analysis_file:
            return None

        await session.delete(analysis_file)

        await session.commit()


async def get_analysis_file(pg: AsyncEngine, file_id: int) -> Optional[AnalysisFile]:
    """
    Get a row that represents an analysis result file by its `id`

    :param pg: PostgreSQL AsyncEngine object
    :param file_id: Row `id` to get
    :return: Row from the `analysis_files` SQL table
    """
    async with AsyncSession(pg) as session:
        upload = (await session.execute(select(AnalysisFile).filter_by(id=file_id))).scalar()

        if not upload:
            return None

    return upload
