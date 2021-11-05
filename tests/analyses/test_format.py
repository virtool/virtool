import json

import pytest

from virtool.analyses.format import transform_coverage_to_coordinates, load_results


@pytest.mark.parametrize("loadable", [True, False])
async def test_load_results(loadable, mocker, tmp_path, config):
    """
    Test that results are loaded from a `results.json` as expected. Check that the file loading action is not pursued
    if the results are stored in the analysis document.

    """
    results = {
        "foo": "bar",
        "bar": "baz"
    }

    document = {
        "_id": "foo",
        "results": "file" if loadable else {"baz": "foo"},
        "sample": {
            "id": "bar"
        }
    }

    results_file = tmp_path / "results.json"
    results_file.write_text(json.dumps(results))

    m_join_analysis_json_path = mocker.patch(
        "virtool.analyses.utils.join_analysis_json_path",
        return_value=str(results_file)
    )

    result = await load_results(config, document)

    if loadable:
        m_join_analysis_json_path.assert_called_with(
            tmp_path,
            "foo",
            "bar"
        )

        assert result == {
            "_id": "foo",
            "results": results,
            "sample": {
                "id": "bar"
            }
        }

        return

    m_join_analysis_json_path.assert_not_called()

    assert result == {
        "_id": "foo",
        "results": {
            "baz": "foo"
        },
        "sample": {
            "id": "bar"
        }
    }


@pytest.mark.parametrize("coverage,expected", [
    (
            [0, 0, 1, 1, 2, 3, 3, 3, 4, 4, 3, 2],
            [(0, 0), (1, 0), (2, 1), (3, 1), (4, 2), (5, 3), (7, 3), (8, 4), (9, 4), (10, 3), (11, 2)]
    ),
    (
            [0, 0, 1, 1, 2, 3, 3, 3, 4, 4, 3, 2, 1, 1],
            [(0, 0), (1, 0), (2, 1), (3, 1), (4, 2), (5, 3), (7, 3), (8, 4), (9, 4), (10, 3), (11, 2), (12, 1), (13, 1)]
    ),
    (
            [0, 0, 0, 1, 1, 1, 0, 0, 1, 1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 2, 2, 2, 5, 5, 4, 4, 3, 3, 2, 2, 1, 1, 5, 5, 5, 6,
             6, 6, 7, 8, 7, 6, 5, 5, 5, 5, 4, 3, 2, 6, 7, 9, 0, 0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 5, 6, 6, 6, 7,
             7, 8, 7, 7, 6, 6, 5, 5, 5, 5, 5, 5, 5, 5, 4, 4, 4, 4, 4, 4, 3, 3, 3, 3, 4, 3, 2, 2, 2, 2, 2, 2, 2, 2, 1, 1,
             2, 3, 2, 3],
            [(0, 0), (2, 0), (3, 1), (5, 1), (6, 0), (7, 0), (8, 1), (10, 1), (11, 2), (15, 2), (16, 3), (18, 3),
             (19, 2), (21, 2), (22, 5), (23, 5), (24, 4), (25, 4), (26, 3), (27, 3), (28, 2), (29, 2), (30, 1), (31, 1),
             (32, 5), (34, 5), (35, 6), (37, 6), (38, 7), (39, 8), (40, 7), (41, 6), (42, 5), (45, 5), (46, 4), (47, 3),
             (48, 2), (49, 6), (50, 7), (51, 9), (52, 0), (56, 0), (57, 1), (58, 1), (59, 2), (60, 2), (61, 3), (62, 3),
             (63, 4), (64, 4), (65, 5), (67, 5), (68, 6), (70, 6), (71, 7), (72, 7), (73, 8), (74, 7), (75, 7), (76, 6),
             (77, 6), (78, 5), (85, 5), (86, 4), (91, 4), (92, 3), (95, 3), (96, 4), (97, 3), (98, 2), (105, 2),
             (106, 1), (107, 1), (108, 2), (109, 3), (110, 2), (111, 3)]

    )
])
def test_transform_coverage_to_coordinates(coverage, expected):
    """
    Test that two sample coverage data sets are correctly converted to coordinates.

    """
    assert transform_coverage_to_coordinates(coverage) == expected
