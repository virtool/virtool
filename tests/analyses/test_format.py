import json

import pytest
from virtool.analyses.format import load_results, transform_coverage_to_coordinates


@pytest.mark.parametrize("loadable", [True, False])
async def test_load_results(loadable, mocker, tmp_path, config):
    """
    Test that results are loaded from a `results.json` as expected. Check that the file loading action is not pursued
    if the results are stored in the analysis document.

    """
    results = {"foo": "bar", "bar": "baz"}

    document = {
        "_id": "foo",
        "results": "file" if loadable else {"baz": "foo"},
        "sample": {"id": "bar"},
    }

    results_file = tmp_path / "results.json"
    results_file.write_text(json.dumps(results))

    m_join_analysis_json_path = mocker.patch(
        "virtool.analyses.utils.join_analysis_json_path", return_value=str(results_file)
    )

    result = await load_results(config, document)

    if loadable:
        m_join_analysis_json_path.assert_called_with(tmp_path, "foo", "bar")

        assert result == {"_id": "foo", "results": results, "sample": {"id": "bar"}}

        return

    m_join_analysis_json_path.assert_not_called()

    assert result == {"_id": "foo", "results": {"baz": "foo"}, "sample": {"id": "bar"}}


@pytest.mark.parametrize(
    "coverage",
    [
        [0, 0, 1, 1, 2, 3, 3, 3, 4, 4, 3, 2],
        [0, 0, 1, 1, 2, 3, 3, 3, 4, 4, 3, 2, 1, 1],
        [
            0,
            0,
            0,
            1,
            1,
            1,
            0,
            0,
            1,
            1,
            1,
            2,
            2,
            2,
            2,
            2,
            3,
            3,
            3,
            2,
            2,
            2,
            5,
            5,
            4,
            4,
            3,
            3,
            2,
            2,
            1,
            1,
            5,
            5,
            5,
            6,
            6,
            6,
            7,
            8,
            7,
            6,
            5,
            5,
            5,
            5,
            4,
            3,
            2,
            6,
            7,
            9,
            0,
            0,
            0,
            0,
            0,
            1,
            1,
            2,
            2,
            3,
            3,
            4,
            4,
            5,
            5,
            5,
            6,
            6,
            6,
            7,
            7,
            8,
            7,
            7,
            6,
            6,
            5,
            5,
            5,
            5,
            5,
            5,
            5,
            5,
            4,
            4,
            4,
            4,
            4,
            4,
            3,
            3,
            3,
            3,
            4,
            3,
            2,
            2,
            2,
            2,
            2,
            2,
            2,
            2,
            1,
            1,
            2,
            3,
            2,
            3,
        ],
    ],
)
def test_transform_coverage_to_coordinates(coverage, snapshot):
    """
    Test that two sample coverage data sets are correctly converted to coordinates.

    """
    assert transform_coverage_to_coordinates(coverage) == snapshot
