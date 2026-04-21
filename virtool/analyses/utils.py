from typing import Any

from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from sqlalchemy.future import select

from virtool.analyses.sql import SQLAnalysisFile

WORKFLOW_NAMES = ("aodp", "nuvs", "pathoscope_bowtie")


def analysis_file_key(name_on_disk: str) -> str:
    """Derive the storage key for an uploaded analysis file."""
    return f"analyses/{name_on_disk}"


def analysis_result_key(analysis_id: str, sample_id: str) -> str:
    """Derive the storage key for an analysis results JSON file."""
    return f"samples/{sample_id}/analysis/{analysis_id}/results.json"


async def attach_analysis_files(
    pg: AsyncEngine,
    analysis_id: str,
    document: dict[str, any],
) -> dict[str, any]:
    """Get analysis result file details for a specific analysis to attach to analysis
    `GET` response.

    :param pg: PostgreSQL AsyncEngine object
    :param analysis_id: An id for a specific analysis
    :param document: The analysis document
    :return: List of file details for each file associated with an analysis
    """
    async with AsyncSession(pg) as session:
        results = (
            (
                await session.execute(
                    select(SQLAnalysisFile).filter_by(analysis=analysis_id),
                )
            )
            .scalars()
            .all()
        )

    return {**document, "files": [result.to_dict() for result in results]}


def find_nuvs_sequence_by_index(
    document: dict[str, Any],
    sequence_index: int,
) -> str | None:
    """Get a sequence from a NuVs analysis document by its sequence index.

    :param document: a NuVs analysis document
    :param sequence_index: the index of the sequence to get
    :return: a NuVs sequence

    """
    sequences = [
        result["sequence"]
        for result in document["results"]["hits"]
        if result["index"] == int(sequence_index)
    ]

    if not sequences:
        return None

    # Raise exception if more than one sequence has the provided index. This should
    # never happen, just being careful.
    if len(sequences) > 1:
        raise ValueError(f"More than one sequence with index {sequence_index}")

    return sequences[0]
