import os

import visvalingamwyatt as vw


def coverage_to_coordinates(coverage_list):
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


def get_nuvs_json_path(data_path, analysis_id, sample_id):
    return os.path.join(
        data_path,
        "samples",
        sample_id,
        "analysis",
        analysis_id,
        "nuvs.json"
    )


def get_pathoscope_json_path(data_path, analysis_id, sample_id):
    return os.path.join(
        data_path,
        "samples",
        sample_id,
        "analysis",
        analysis_id,
        "pathoscope.json"
    )


def get_nuvs_sequence_by_index(document, sequence_index):
    """
    Get a sequence from a NuVs analysis document by its sequence index.

    :param document: a NuVs analysis document
    :type document: dict

    :param sequence_index: the index of the sequence to get
    :type sequence_index: int

    :return: a NuVs sequence
    :rtype: Union[None, dict]

    """
    sequences = [result["sequence"] for result in document["results"] if result["index"] == int(sequence_index)]

    # Empty sequences list means sequence was not found.
    if not sequences:
        return None

    # Raise exception if more than one sequence has the provided index. This should never happen, just being careful.
    if len(sequences) > 1:
        raise ValueError(f"More than one sequence with index {sequence_index}")

    return sequences[0]
