import pytest

import virtool.analyses


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
    assert virtool.analyses.coverage_to_coordinates(coverage) == expected


def test_get_nuvs_json_path():
    path = virtool.analyses.get_nuvs_json_path("data_foo", "foobar", "baz")
    assert path == "data_foo/samples/foobar/analysis/baz/nuvs.json"
