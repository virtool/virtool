import json

import pytest

import virtool.analyses.format


@pytest.mark.parametrize("loadable", [True, False])
async def test_load_results(loadable, mocker, tmpdir):
    """
    Test that results are loaded from a `results.json` as expected. Check that the file loading action is not pursued
    if the results are stored in the analysis document.

    """
    settings = {
        "data_path": str(tmpdir)
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

    results_file = tmpdir.join("results.json")
    results_file.write(json.dumps(results))

    m_join_analysis_json_path = mocker.patch(
        "virtool.analyses.utils.join_analysis_json_path",
        return_value=str(results_file)
    )

    result = await virtool.analyses.format.load_results(settings, document)

    if loadable:
        m_join_analysis_json_path.assert_called_with(
            str(tmpdir),
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





