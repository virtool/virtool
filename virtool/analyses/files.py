from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.analyses.sql import SQLAnalysisFile


async def create_analysis_file(
    pg: AsyncEngine,
    analysis_id: str,
    analysis_format: str,
    name: str,
    size: int = None,
) -> dict[str, any]:
    """Create a row in the `analysis_files` SQL table that represents an analysis result
    file.

    :param pg: PostgreSQL AsyncEngine object
    :param analysis_id: ID that corresponds to a parent analysis
    :param analysis_format: Format of the analysis result file
    :param name: Name of the analysis result file
    :param size: Size of the analysis result file
    :return: A dictionary representation of the newly created row
    """
    async with AsyncSession(pg) as session:
        analysis_file = SQLAnalysisFile(
            name=name,
            analysis=analysis_id,
            format=analysis_format,
            size=size,
        )

        session.add(analysis_file)

        await session.flush()

        analysis_file.name_on_disk = f"{analysis_file.id}-{analysis_file.name}"

        analysis_file = analysis_file.to_dict()

        await session.commit()

        return analysis_file
