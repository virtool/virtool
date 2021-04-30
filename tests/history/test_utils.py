import json
import os
import pytest
from pathlib import Path

import virtool.history.utils

TEST_DIFF_PATH = Path.cwd() / "tests" / "test_files" / "diff.json"


def test_calculate_diff(test_otu_edit):
    """
    Test that a diff is correctly calculated. Should work since the tested function is a very light wrapper for the
    dict differ function.

    """
    old, new = test_otu_edit

    diff = virtool.history.utils.calculate_diff(old, new)

    assert diff.sort() == [
        ("change", "name", ("Prunus virus F", "Prunus virus E")),
        ("change", "abbreviation", ("PVF", "")), ("change", "version", (0, 1))
    ].sort()


@pytest.mark.parametrize("document,description", [
    # Name and abbreviation.
    ({
        "name": "Tobacco mosaic virus",
        "abbreviation": "TMV"
    }, "Created Tobacco mosaic virus (TMV)"),

    # Name only.
    ({
        "name": "Tobacco mosaic virus",
        "abbreviation": "",
    }, "Created Tobacco mosaic virus")
])
def test_compose_create_description(document, description):
    assert virtool.history.utils.compose_create_description(document) == description


@pytest.mark.parametrize("name,abbreviation,old_abbreviation,schema,description", [
    # Only change name.
    (
        "Tobacco mosaic virus", None, "", None,
        "Changed name to Tobacco mosaic virus"
    ),
    # Change name and add an abbreviation where none was defined before.
    (
        "Tobacco mosaic virus", "TMV", "", None,
        "Changed name to Tobacco mosaic virus and added abbreviation TMV"
    ),
    # Change both name and abbreviation.
    (
        "Tobacco mosaic virus", "THG", "TMV", None,
        "Changed name to Tobacco mosaic virus and changed abbreviation to THG"
    ),
    # Change name and remove abbreviation.
    (
        "Tobacco mosaic virus", "", "TMV", None,
        "Changed name to Tobacco mosaic virus and removed abbreviation TMV"
    ),
    # Add an abbreviation where none was defined before.
    (
        None, "THG", "", None,
        "Added abbreviation THG"
    ),
    # Only change abbreviation.
    (
        None, "THG", "TMV", None,
        "Changed abbreviation to THG"
    ),
    # Only modify schema.
    (
        None, None, "", "schema",
        "Modified schema"
    ),
    # Modify schema and change name.
    (
        "Tobacco mosaic virus", None, "", "schema",
        "Changed name to Tobacco mosaic virus and modified schema"
    ),
    # Modify schema, change name, and add abbreviation
])
def test_compose_edit_description(name, abbreviation, old_abbreviation, schema, description):
    assert virtool.history.utils.compose_edit_description(name, abbreviation, old_abbreviation, schema) == description


@pytest.mark.parametrize("has_abbreviation", [True, False])
def test_compose_remove_description(has_abbreviation):
    document = {
        "name": "Tobacco mosaic virus"
    }

    if has_abbreviation:
        document["abbreviation"] = "TMV"

    description = virtool.history.utils.compose_remove_description(document)

    expected = "Removed Tobacco mosaic virus"

    if has_abbreviation:
        expected += " (TMV)"

    assert description == expected


@pytest.mark.parametrize("version", [None, "3", 5])
@pytest.mark.parametrize("missing", [None, "old", "new"])
def test_derive_otu_information(version, missing):
    """
    Test that OTU information is derived correctly from the old and new versions of a joined OTU.

    """
    old = None
    new = None

    if missing != "old":
        old = {
            "_id": "foo",
            "name": "Foo",
            "reference": {
                "id": "foo_ref"
            }
        }

    if missing != "new":
        new = {
            "_id": "bar",
            "name": "Bar",
            "reference": {
                "id": "bar_ref"
            }
        }

        if version:
            new["version"] = version

    otu_id, otu_name, otu_version, ref_id = virtool.history.utils.derive_otu_information(
        old,
        new
    )

    if missing == "old":
        assert otu_id == "bar"
        assert otu_name == "Bar"
        assert ref_id == "bar_ref"
    else:
        assert otu_id == "foo"
        assert otu_name == "Foo"
        assert ref_id == "foo_ref"

    if missing == "new" or version is None:
        assert otu_version == "removed"
    elif version == "3":
        assert otu_version == 3
    else:
        assert otu_version == 5


def test_join_diff_path(tmp_path):
    path = virtool.history.utils.join_diff_path(
        tmp_path,
        "foo",
        "2"
    )

    assert path == tmp_path / "history/foo_2.json"


@pytest.mark.parametrize("is_datetime", [True, False])
def test_json_encoder(is_datetime, static_time):
    """
    Test that the custom encoder correctly encodes `datetime` objects to ISO format dates.

    """
    o = "foo"

    if is_datetime:
        o = static_time.datetime

    result = virtool.history.utils.json_encoder(o)

    assert result == "foo" if o == "foo" else static_time.iso


def test_json_object_hook(static_time):
    """
    Test that the hook function correctly decodes created_at ISO format fields to naive `datetime` objects.

    """
    o = {
        "foo": "bar",
        "created_at": static_time.iso
    }

    result = virtool.history.utils.json_object_hook(o)

    assert result == {
        "foo": "bar",
        "created_at": static_time.datetime
    }


async def test_read_diff_file(mocker, snapshot):
    """
    Test that a diff is parsed to a `dict` correctly. ISO format dates must be converted to `datetime` objects.

    """
    m = mocker.patch("virtool.history.utils.join_diff_path", return_value=TEST_DIFF_PATH)

    diff = await virtool.history.utils.read_diff_file("foo", "bar", "baz")

    m.assert_called_with("foo", "bar", "baz")
    snapshot.assert_match(diff)


async def test_remove_diff_files(loop, tmp_path):
    """
    Test that diff files are removed correctly and the function can handle a non-existent diff file.

    """
    history_dir = tmp_path / "history"
    history_dir.mkdir()

    history_dir.joinpath("foo_0.json").write_text("hello world")
    history_dir.joinpath("foo_1.json").write_text("hello world")
    history_dir.joinpath("bar_0.json").write_text("hello world")
    history_dir.joinpath("bar_1.json").write_text("hello world")

    id_list = [
        "foo.0",
        "foo.1",
        "foo.2",
        "bar.0"
    ]

    async def run_in_thread(func, *args):
        return await loop.run_in_executor(None, func, *args),

    app = {
        "run_in_thread": run_in_thread,
        "settings": {
            "data_path": tmp_path
        }
    }

    await virtool.history.utils.remove_diff_files(
        app,
        id_list
    )

    assert os.listdir(history_dir) == ["bar_1.json"]


async def test_write_diff_file(snapshot, tmp_path):
    """
    Test that a diff file is written correctly.

    """
    (tmp_path / "history").mkdir()

    with open(TEST_DIFF_PATH, "r") as f:
        diff = json.load(f)

    await virtool.history.utils.write_diff_file(tmp_path, "foo", "1", diff)

    path = tmp_path / "history" / "foo_1.json"

    with open(path, "r") as f:
        snapshot.assert_match(json.load(f))
