import pytest

import virtool.analyses.utils


@pytest.mark.parametrize("coverage,expected", [
    (
        [0, 0, 1, 1, 2, 3, 3, 3, 4, 4, 3, 2],
        [(0, 0), (1, 0), (2, 1), (3, 1), (4, 2), (5, 3), (7, 3), (8, 4), (9, 4), (10, 3), (11, 2)]
    ),
    (
        [0, 0, 1, 1, 2, 3, 3, 3, 4, 4, 3, 2, 1, 1],
        [(0, 0), (1, 0), (2, 1), (3, 1), (4, 2), (5, 3), (7, 3), (8, 4), (9, 4), (10, 3), (11, 2), (12, 1), (13, 1)]
    )
])
def test_collapse_pathoscope_coverage(coverage, expected):
    """
    Test that two sample coverage data sets are correctly converted to coordinates.

    """
    assert virtool.analyses.utils.transform_coverage_to_coordinates(coverage) == expected


@pytest.mark.parametrize("name", ["nuvs", "pathoscope"])
def test_get_json_path(name):
    """
    Test that the function can correctly extrapolate the path to a nuvs.json file given the `data_path`, `sample_id`,
    and `analysis_id` arguments.

    """
    func = virtool.analyses.utils.join_nuvs_json_path if name == "nuvs" else virtool.analyses.utils.join_pathoscope_json_path

    path = func("data_foo", "analysis_bar", "sample_foo")

    assert path == "data_foo/samples/sample_foo/analysis/analysis_bar/{}.json".format(name)
