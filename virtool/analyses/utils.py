import os
import shutil
from typing import Any, Dict, List, Optional, Tuple

import visvalingamwyatt as vw
from sqlalchemy.ext.asyncio import AsyncSession, AsyncEngine
from sqlalchemy.future import select

import virtool.utils

from virtool.analyses.models import AnalysisFile

WORKFLOW_NAMES = (
    "aodp",
    "nuvs",
    "pathoscope_bowtie"
)


async def attach_analysis_files(pg: AsyncEngine, analysis_id: str, document: Dict[str, any]) -> Dict[str, any]:
    """
    Get analysis result file details for a specific analysis to attach to analysis `GET` response

    :param pg: PostgreSQL AsyncEngine object
    :param analysis_id: An id for a specific analysis
    :param document: The analysis document
    :return: List of file details for each file associated with an analysis
    """
    async with AsyncSession(pg) as session:
        results = (await session.execute(select(AnalysisFile).filter_by(analysis=analysis_id))).scalars().all()

    return {
        **document,
        "files": [result.to_dict() for result in results]
    }


def check_nuvs_file_type(file_name: str) -> str:
    """
    Get the NuVs analysis file type based on the extension of given `file_name`

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


async def move_nuvs_files(filename: str, run_in_thread: callable, file_path: str, target_path: str):
    """
    Move NuVs analysis files from `file_path` to `target_path`, compress FASTA files and FASTQ files.

    :param filename: the name of the analysis file
    :param run_in_thread: the application thread running function
    :param file_path: the path to the original file
    :param target_path: the path to the new directory

    """
    if filename == "hmm.tsv":
        await run_in_thread(
            shutil.copy,
            os.path.join(file_path, "hmm.tsv"),
            os.path.join(target_path, "hmm.tsv")
        )
    else:
        await run_in_thread(virtool.utils.compress_file,
                            os.path.join(file_path, filename),
                            os.path.join(target_path, f"{filename}.gz"))


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
