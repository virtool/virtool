from typing import Any

from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from sqlalchemy.future import select

from virtool.analyses.sql import SQLAnalysisFile

WORKFLOW_NAMES = ("nuvs", "pathoscope")


def analysis_file_key(name_on_disk: str) -> str:
    """Derive the storage key for an uploaded analysis file."""
    return f"analyses/{name_on_disk}"


async def attach_analysis_files(
    pg: AsyncEngine,
    analysis_id: int,
    document: dict[str, any],
) -> dict[str, any]:
    """Get analysis result file details for a specific analysis to attach to analysis
    `GET` response.

    :param pg: PostgreSQL AsyncEngine object
    :param analysis_id: the integer ID of the analysis whose files to attach
    :param document: The analysis document
    :return: List of file details for each file associated with an analysis
    """
    async with AsyncSession(pg) as session:
        results = (
            (
                await session.execute(
                    select(SQLAnalysisFile).filter_by(analysis_id=analysis_id),
                )
            )
            .scalars()
            .all()
        )

    files = []

    for result in results:
        file = result.to_dict()
        file["analysis"] = file.pop("analysis_id")
        files.append(file)

    return {**document, "files": files}


def find_nuvs_sequence_by_index(
    results: dict[str, Any],
    sequence_index: int,
) -> str | None:
    """Get a sequence from a NuVs analysis results dict by its sequence index.

    :param results: a NuVs analysis results dict
    :param sequence_index: the index of the sequence to get
    :return: a NuVs sequence

    """
    sequences = [
        result["sequence"]
        for result in results["hits"]
        if result["index"] == int(sequence_index)
    ]

    if not sequences:
        return None

    # Raise exception if more than one sequence has the provided index. This should
    # never happen, just being careful.
    if len(sequences) > 1:
        raise ValueError(f"More than one sequence with index {sequence_index}")

    return sequences[0]
