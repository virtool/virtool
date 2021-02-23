import os
from typing import Any, Dict, List, Optional, Tuple

import visvalingamwyatt as vw
from sqlalchemy.ext.asyncio import AsyncSession, AsyncEngine
from sqlalchemy.future import select

from virtool.analyses.models import AnalysisFile

WORKFLOW_NAMES = (
    "aodp",
    "nuvs",
    "pathoscope_bowtie"
)


async def attach_analysis_files(pg: AsyncEngine, analysis_id: str) -> List[Dict]:
    """
    Get analysis result file details for a specific analysis to attach to analysis `GET` response

    :param pg: PostgreSQL AsyncEngine object
    :param analysis_id: An id for a specific analysis
    :return: List of file details for each file associated with an analysis
    """
    async with AsyncSession(pg) as session:
        results = (await session.execute(select(AnalysisFile).filter_by(analysis=analysis_id))).scalars().all()

    return [result.to_dict() for result in results]


def find_nuvs_sequence_by_index(
        document: Dict[str, Any],
        sequence_index: int
) -> Optional[Dict[str, Any]]:
    """
    Get a sequence from a NuVs analysis document by its sequence index.

    :param document: a NuVs analysis document
    :param sequence_index: the index of the sequence to get
    :return: a NuVs sequence

    """
    sequences = [result["sequence"] for result in document["results"] if
                 result["index"] == int(sequence_index)]

    if not sequences:
        return None

    # Raise exception if more than one sequence has the provided index. This should never happen,
    # just being careful.
    if len(sequences) > 1:
        raise ValueError(f"More than one sequence with index {sequence_index}")

    return sequences[0]


def join_analysis_path(data_path: str, analysis_id: str, sample_id: str) -> str:
    """
    Returns the path to an analysis JSON output file.

    :param data_path: the application data path
    :param analysis_id: the id of the NuVs analysis
    :param sample_id: the id of the parent sample
    :return: an analysis JSON path

    """
    return os.path.join(
        data_path,
        "samples",
        sample_id,
        "analysis",
        analysis_id
    )


def join_analysis_json_path(data_path: str, analysis_id: str, sample_id: str) -> str:
    """
    Join the path to an analysis JSON file for the given sample-analysis ID combination.

    Analysis JSON files are created when the analysis data is too large for a MongoDB document.

    :param data_path: the path to the application data
    :param analysis_id: the ID of the analysis
    :param sample_id: the ID of the sample
    :return: a path

    """
    return os.path.join(
        join_analysis_path(data_path, analysis_id, sample_id),
        "results.json"
    )


def transform_coverage_to_coordinates(coverage_list: List[int]) -> List[Tuple[int, int]]:
    """
    Takes a list of read depths where the list index is equal to the read position + 1 and returns
    a list of (x, y) coordinates.

    The coordinates will be simplified using Visvalingham-Wyatt algorithm if the list exceeds 100
    pairs.

    :param coverage_list: a list of position-indexed depth values
    :return: a list of (x, y) coordinates

    """
    previous_depth = coverage_list[0]
    coordinates = {(0, previous_depth)}

    last = len(coverage_list) - 1

    for i, depth in enumerate(coverage_list):
        if depth != previous_depth or i == last:
            coordinates.add((i - 1, previous_depth))
            coordinates.add((i, depth))

            previous_depth = depth

    coordinates = sorted(list(coordinates), key=lambda x: x[0])

    if len(coordinates) > 100:
        return vw.simplify(coordinates, ratio=0.4)

    return coordinates
