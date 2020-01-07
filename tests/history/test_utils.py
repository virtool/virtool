import datetime
import json
import os
import sys
import pytest
import filecmp

import virtool.history.utils

TEST_DIFF_PATH = os.path.join(sys.path[0], "tests", "test_files", "diff.json")


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


async def test_read_diff_file(mocker, snapshot):
    """
    Test that a diff is parsed to a `dict` correctly. ISO format dates must be converted to `datetime` objects.

    """
    m = mocker.patch("virtool.history.utils.join_diff_path", return_value=TEST_DIFF_PATH)

    diff = await virtool.history.utils.read_diff_file("foo", "bar", "baz")

    m.assert_called_with("foo", "bar", "baz")
    snapshot.assert_match(diff)


async def test_write_diff_file(mocker, tmpdir):
    """
    Test that a diff file is written correctly.

    """
    with open(TEST_DIFF_PATH, "r") as f:
        diff = json.load(f)

    await virtool.history.utils.write_diff_file(str(tmpdir), "foo", "1", diff)

    path = os.path.join(str(tmpdir), "foo_1.json")
