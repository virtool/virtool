import json

import pytest

import virtool.analyses.format


@pytest.mark.parametrize("loadable", [True, False])
async def test_load_results(loadable, mocker, tmp_path):
    """
    Test that results are loaded from a `results.json` as expected. Check that the file loading action is not pursued
    if the results are stored in the analysis document.

    """
    settings = {
        "data_path": tmp_path
    }

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

    result = await virtool.analyses.format.load_results(settings, document)

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
