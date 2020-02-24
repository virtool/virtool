import os
from typing import Union

import visvalingamwyatt as vw

ALGORITHM_NAMES = (
    "aodp",
    "nuvs",
    "pathoscope_bowtie"
)


def transform_coverage_to_coordinates(coverage_list: list) -> list:
    """
    Takes a list of read depths where the list index is equal to the read position + 1 and returns a list of (x, y)
    coordinates.

    The coordinates will be simplified using Visvalingham-Wyatt algorithm if the list exceeds 100 pairs.

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


def find_nuvs_sequence_by_index(document: dict, sequence_index: int) -> Union[None, dict]:
    """
    Get a sequence from a NuVs analysis document by its sequence index.

    :param document: a NuVs analysis document
    :param sequence_index: the index of the sequence to get
    :return: a NuVs sequence

    """
    sequences = [result["sequence"] for result in document["results"] if result["index"] == int(sequence_index)]

    # Empty sequences list means sequence was not found.
    if not sequences:
        return None

    # Raise exception if more than one sequence has the provided index. This should never happen, just being careful.
    if len(sequences) > 1:
        raise ValueError(f"More than one sequence with index {sequence_index}")

    return sequences[0]


def join_analysis_path(data_path, analysis_id, sample_id):
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


def join_analysis_json_path(data_path, analysis_id, sample_id):
    return os.path.join(
        join_analysis_path(data_path, analysis_id, sample_id),
        "results.json"
    )
