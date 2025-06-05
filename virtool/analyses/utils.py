from pathlib import Path
from typing import Any

from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from sqlalchemy.future import select

from virtool.analyses.sql import SQLAnalysisFile

WORKFLOW_NAMES = ("aodp", "nuvs", "pathoscope_bowtie")


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


def join_analysis_path(data_path: Path, analysis_id: str, sample_id: str) -> Path:
    """Returns the path to an analysis JSON output file.

    :param data_path: the application data path
    :param analysis_id: the id of the NuVs analysis
    :param sample_id: the id of the parent sample
    :return: an analysis JSON path

    """
    return data_path / "samples" / sample_id / "analysis" / analysis_id


def join_analysis_json_path(data_path: Path, analysis_id: str, sample_id: str) -> Path:
    """Join the path to an analysis JSON file for the given sample-analysis ID
    combination.

    Analysis JSON files are created when the analysis data is too large for a MongoDB
    document.

    :param data_path: the path to the application data
    :param analysis_id: the ID of the analysis
    :param sample_id: the ID of the sample
    :return: a path

    """
    return join_analysis_path(data_path, analysis_id, sample_id) / "results.json"
