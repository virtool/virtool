import json
from pathlib import Path

import pytest
from syrupy import SnapshotAssertion

from virtool.history.utils import (
    calculate_diff,
    compose_create_description,
    compose_edit_description,
    compose_remove_description,
    derive_otu_information,
    json_encoder,
    json_object_hook,
    read_diff_file,
    remove_diff_files,
    write_diff_file,
)
from virtool.storage.memory import MemoryStorageProvider


def test_calculate_diff(test_otu_edit):
    """Test that a diff is correctly calculated. Should work since the tested function
    is a very light wrapper for the dict differ function.
    """
    old, new = test_otu_edit

    diff = calculate_diff(old, new)

    assert (
        diff.sort()
        == [
            ("change", "name", ("Prunus virus F", "Prunus virus E")),
            ("change", "abbreviation", ("PVF", "")),
            ("change", "version", (0, 1)),
        ].sort()
    )


@pytest.mark.parametrize(
    "document,description",
    [
        # Name and abbreviation.
        (
            {"name": "Tobacco mosaic virus", "abbreviation": "TMV"},
            "Created Tobacco mosaic virus (TMV)",
        ),
        # Name only.
        (
            {
                "name": "Tobacco mosaic virus",
                "abbreviation": "",
            },
            "Created Tobacco mosaic virus",
        ),
    ],
)
def test_compose_create_description(document, description):
    assert compose_create_description(document) == description


@pytest.mark.parametrize(
    "name,abbreviation,old_abbreviation,schema,description",
    [
        # Only change name.
        (
            "Tobacco mosaic virus",
            None,
            "",
            None,
            "Changed name to Tobacco mosaic virus",
        ),
        # Change name and add an abbreviation where none was defined before.
        (
            "Tobacco mosaic virus",
            "TMV",
            "",
            None,
            "Changed name to Tobacco mosaic virus and added abbreviation TMV",
        ),
        # Change both name and abbreviation.
        (
            "Tobacco mosaic virus",
            "THG",
            "TMV",
            None,
            "Changed name to Tobacco mosaic virus and changed abbreviation to THG",
        ),
        # Change name and remove abbreviation.
        (
            "Tobacco mosaic virus",
            "",
            "TMV",
            None,
            "Changed name to Tobacco mosaic virus and removed abbreviation TMV",
        ),
        # Add an abbreviation where none was defined before.
        (None, "THG", "", None, "Added abbreviation THG"),
        # Only change abbreviation.
        (None, "THG", "TMV", None, "Changed abbreviation to THG"),
        # Only modify schema.
        (None, None, "", "schema", "Modified schema"),
        # Modify schema and change name.
        (
            "Tobacco mosaic virus",
            None,
            "",
            "schema",
            "Changed name to Tobacco mosaic virus and modified schema",
        ),
        # Modify schema, change name, and add abbreviation
    ],
)
def test_compose_edit_description(
    name,
    abbreviation,
    old_abbreviation,
    schema,
    description,
):
    assert (
        compose_edit_description(name, abbreviation, old_abbreviation, schema)
        == description
    )


@pytest.mark.parametrize("has_abbreviation", [True, False])
def test_compose_remove_description(has_abbreviation):
    document = {"name": "Tobacco mosaic virus"}

    if has_abbreviation:
        document["abbreviation"] = "TMV"

    description = compose_remove_description(document)

    expected = "Removed Tobacco mosaic virus"

    if has_abbreviation:
        expected += " (TMV)"

    assert description == expected


@pytest.mark.parametrize("version", [None, "3", 5])
@pytest.mark.parametrize("missing", [None, "old", "new"])
def test_derive_otu_information(version, missing):
    """Test that OTU information is derived correctly from the old and new versions of a
    joined OTU.
    """
    old = None
    new = None

    if missing != "old":
        old = {"_id": "foo", "name": "Foo", "reference": {"id": "foo_ref"}}

    if missing != "new":
        new = {"_id": "bar", "name": "Bar", "reference": {"id": "bar_ref"}}

        if version:
            new["version"] = version

    otu_id, otu_name, otu_version, ref_id = derive_otu_information(old, new)

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


@pytest.mark.parametrize("is_datetime", [True, False])
def test_json_encoder(is_datetime, static_time):
    """Test that the custom encoder correctly encodes `datetime` objects to ISO format
    dates.
    """
    o = "foo"

    if is_datetime:
        o = static_time.datetime

    result = json_encoder(o)

    assert result == "foo" if o == "foo" else static_time.iso


def test_json_object_hook(static_time):
    """Test that the hook function correctly decodes created_at ISO format fields to
    naive `datetime` objects.
    """
    o = {"foo": "bar", "created_at": static_time.iso}

    result = json_object_hook(o)

    assert result == {"foo": "bar", "created_at": static_time.datetime}


async def test_read_diff_file(example_path: Path, snapshot: SnapshotAssertion):
    """Test that a diff is parsed to a `dict` correctly. ISO format dates must be
    converted to `datetime` objects.
    """
    storage = MemoryStorageProvider()

    with open(example_path / "diff.json", "rb") as f:
        raw = f.read()

    async def _data():
        yield raw

    await storage.write("history/bar_baz.json", _data())

    assert await read_diff_file(storage, "bar", "baz") == snapshot


async def test_remove_diff_files():
    """Test that diff files are removed correctly and the function can handle a
    non-existent diff file.
    """
    storage = MemoryStorageProvider()

    for key in [
        "history/foo_0.json",
        "history/foo_1.json",
        "history/bar_0.json",
        "history/bar_1.json",
    ]:

        async def _data():
            yield b"hello world"

        await storage.write(key, _data())

    id_list = ["foo.0", "foo.1", "foo.2", "bar.0"]

    await remove_diff_files(storage, id_list)

    remaining = [obj.key async for obj in storage.list("history/")]
    assert remaining == ["history/bar_1.json"]


async def test_write_diff_file(example_path: Path, snapshot: SnapshotAssertion):
    """Test that a diff file is written correctly."""
    storage = MemoryStorageProvider()

    with open(example_path / "diff.json") as f:
        diff = json.load(f)

    await write_diff_file(storage, "foo", "1", diff)

    chunks = []
    async for chunk in storage.read("history/foo_1.json"):
        chunks.append(chunk)

    assert json.loads(b"".join(chunks)) == snapshot
