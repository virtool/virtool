import shutil
from pathlib import Path
from typing import Any, Dict, Optional

from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from sqlalchemy.future import select

import virtool.utils
from virtool.analyses.models import AnalysisFile

WORKFLOW_NAMES = ("aodp", "nuvs", "pathoscope_bowtie")


async def attach_analysis_files(
    pg: AsyncEngine, analysis_id: str, document: Dict[str, any]
) -> Dict[str, any]:
    """
    Get analysis result file details for a specific analysis to attach to analysis `GET`
    response.

    :param pg: PostgreSQL AsyncEngine object
    :param analysis_id: An id for a specific analysis
    :param document: The analysis document
    :return: List of file details for each file associated with an analysis
    """
    async with AsyncSession(pg) as session:
        results = (
            (
                await session.execute(
                    select(AnalysisFile).filter_by(analysis=analysis_id)
                )
            )
            .scalars()
            .all()
        )

    return {**document, "files": [result.to_dict() for result in results]}


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
    document: Dict[str, Any], sequence_index: int
) -> Optional[str]:
    """
    Get a sequence from a NuVs analysis document by its sequence index.

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
    """
    Returns the path to an analysis JSON output file.

    :param data_path: the application data path
    :param analysis_id: the id of the NuVs analysis
    :param sample_id: the id of the parent sample
    :return: an analysis JSON path

    """
    return data_path / "samples" / sample_id / "analysis" / analysis_id


def join_analysis_json_path(data_path: Path, analysis_id: str, sample_id: str) -> Path:
    """
    Join the path to an analysis JSON file for the given sample-analysis ID combination.

    Analysis JSON files are created when the analysis data is too large for a MongoDB
    document.

    :param data_path: the path to the application data
    :param analysis_id: the ID of the analysis
    :param sample_id: the ID of the sample
    :return: a path

    """
    return join_analysis_path(data_path, analysis_id, sample_id) / "results.json"


async def move_nuvs_files(
    filename: str, run_in_thread: callable, file_path: Path, target_path: Path
):
    """
    Move NuVs analysis files from `file_path` to `target_path`, compress FASTA files
    and FASTQ files.

    :param filename: the name of the analysis file
    :param run_in_thread: the application thread running function
    :param file_path: the path to the original file
    :param target_path: the path to the new directory

    """
    if filename == "hmm.tsv":
        await run_in_thread(shutil.copy, file_path / "hmm.tsv", target_path / "hmm.tsv")
    else:
        await run_in_thread(
            virtool.utils.compress_file,
            file_path / filename,
            target_path / f"{filename}.gz",
        )
