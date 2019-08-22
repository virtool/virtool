import os
import pytest
import json
import virtool.analyses.migrate
from aiohttp.test_utils import make_mocked_coro


async def test_migrate_analyses(mocker, dbi):
    """
    Make sure all of the migration functions compose together correctly.

    """
    settings = {
        "foo": "bar"
    }

    m_rename_results_field = mocker.patch(
        "virtool.analyses.migrate.rename_results_field",
        make_mocked_coro()
    )

    m_convert_pathoscope_files = mocker.patch(
        "virtool.analyses.migrate.convert_pathoscope_files",
        make_mocked_coro()
    )

    m_rename_analysis_json_files = mocker.patch(
        "virtool.analyses.migrate.rename_analysis_json_files",
        make_mocked_coro()
    )

    m_delete_unready = mocker.patch(
        "virtool.db.migrate.delete_unready",
        make_mocked_coro()
    )

    await virtool.analyses.migrate.migrate_analyses(dbi, settings)

    m_rename_results_field.assert_called_with(dbi)
    m_convert_pathoscope_files.assert_called_with(dbi, settings)
    m_rename_analysis_json_files.assert_called_with(settings)
    m_delete_unready.assert_called_with(dbi.analyses)


async def test_convert_pathoscope_file(tmpdir, dbi):
    """
    Test that `convert_pathoscope_file` converts the legacy 3-key pathoscope file to a file containing only the
    diagnostic result data. The other two keys ('read_count` and `ready`) are moved to the database.

    """
    old_data = {
        "read_count": 22,
        "ready": True,
        "diagnosis": [
            "a", "b"
        ]
    }

    # Create the analysis directory and JSON file.
    p = tmpdir.mkdir("samples").mkdir("foo").mkdir("analysis").mkdir("bar").join("pathoscope.json")
    p.write(json.dumps(old_data))

    # Insert an analysis document to be populated with `read_count` and `ready` from the JSON file.
    await dbi.analyses.insert_one({
        "_id": "bar"
    })

    await virtool.analyses.migrate.convert_pathoscope_file(
        dbi,
        "bar",
        "foo",
        str(tmpdir)
    )

    # Ensure that only the diagnostic data is retained in the `pathoscope.json` file.
    with open(str(p), "r") as f:
        assert json.load(f) == ["a", "b"]

    # Ensure the spare keys are assigned to the database document for the analysis.
    assert await dbi.analyses.find_one() == {
        "_id": "bar",
        "ready": True,
        "read_count": 22
    }


@pytest.mark.parametrize("exclusion", [
    {"algorithm": "nuvs"},
    {"results": []},
    {"read_count": 23}
], ids=["algorithm", "non-file", "read_count"])
async def test_convert_pathoscope_files(exclusion, mocker, dbi):
    """
    Test that `convert_pathoscope_file` is called for all matching analysis document.

    """
    settings = {
        "data_path": "/files"
    }

    m_convert_pathoscope_file = mocker.patch("virtool.analyses.migrate.convert_pathoscope_file", make_mocked_coro())

    documents = [
        {"_id": "foo", "sample": {"id": "hello"}, "algorithm": "pathoscope_bowtie", "results": "file"},
        {"_id": "bar", "sample": {"id": "hello"}, "algorithm": "pathoscope_bowtie", "results": "file"},
        {"_id": "baz", "sample": {"id": "world"}, "algorithm": "pathoscope_bowtie", "results": "file"}
    ]

    documents[1].update(exclusion)

    await dbi.analyses.insert_many(documents)

    await virtool.analyses.migrate.convert_pathoscope_files(dbi, settings)

    assert m_convert_pathoscope_file.called

    m_convert_pathoscope_file.assert_has_calls([
        mocker.call(dbi, "foo", "hello", "/files"),
        mocker.call(dbi, "baz", "world", "/files")
    ])


async def test_rename_analysis_json_files(tmpdir):
    """
    Test that all and only the `nuvs.json` and `pathoscope.json` files are renamed.

    """

    settings = {
        "data_path": str(tmpdir)
    }

    s = tmpdir.mkdir("samples")

    sample_ids = ["a", "b"]

    for sample_id in sample_ids:
        a = s.mkdir(sample_id).mkdir("analysis")

        # Check that matching JSON files are renamed.
        a.mkdir("foo").join("pathoscope.json").write("hello_world")
        a.mkdir("bar").join("nuvs.json").write("hello_world")

        # Check that the non-matching JSON is kept and `pathoscope.json` is renamed.
        baz = a.mkdir("baz")
        baz.join("pathoscope.json").write("hello_world")
        baz.join("ignore.json").write("hello_world")

        # Check that the non-matching JSON is kept and `pathoscope.json` is renamed.
        bam = a.mkdir("bam")
        bam.join("nuvs.json").write("hello_world")
        bam.join("ignore.json").write("hello_world")

        # Check that non-matching JSON is not touched even when it is the only file.
        a.mkdir("bat").join("ignore.json").write("hello_world")

    await virtool.analyses.migrate.rename_analysis_json_files(settings)

    for sample_id in sample_ids:
        analysis_path = os.path.join(str(tmpdir), "samples", sample_id, "analysis")

        # Paths where all JSON files were renamed.
        assert os.listdir(os.path.join(analysis_path, "foo")) == ["results.json"]
        assert os.listdir(os.path.join(analysis_path, "bar")) == ["results.json"]

        # Path were pathoscope.json was renamed and one was untouched.
        assert os.listdir(os.path.join(analysis_path, "baz")) == ["results.json", "ignore.json"]

        # Path were nuvs.json was renamed and one was untouched.
        assert os.listdir(os.path.join(analysis_path, "bam")) == ["results.json", "ignore.json"]

        # Paths were all were ignored.
        assert os.listdir(os.path.join(analysis_path, "bat")) == ["ignore.json"]


async def test_rename_results_field(dbi):
    """
    Test that only the `diagnosis` field is renamed to `results`.

    Don't bother testing effects on `nuvs` documents. They already use the results field name and will be ignored by the
    `{"algorithm": "pathoscope_bowtie"}` query.

    """
    await dbi.analyses.insert_many([
        {"_id": "foo", "algorithm": "pathoscope_bowtie", "hello": "world", "diagnosis": "foobar"},
        {"_id": "bar", "algorithm": "pathoscope_bowtie", "hello": "world", "results": "foobar"},
        {"_id": "baz", "algorithm": "pathoscope_bowtie", "hello": "world", "diagnosis": "file"},
        {"_id": "cod", "algorithm": "pathoscope_bowtie", "hello": "world", "results": "file"}
    ])

    await virtool.analyses.migrate.rename_results_field(dbi)

    assert await dbi.analyses.find({}).sort("_id").to_list(None) == [
        {"_id": "bar", "algorithm": "pathoscope_bowtie", "hello": "world", "results": "foobar"},
        {"_id": "baz", "algorithm": "pathoscope_bowtie", "hello": "world", "results": "file"},
        {"_id": "cod", "algorithm": "pathoscope_bowtie", "hello": "world", "results": "file"},
        {"_id": "foo", "algorithm": "pathoscope_bowtie", "hello": "world", "results": "foobar"}
    ]
