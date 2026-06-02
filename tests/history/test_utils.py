import pytest

from virtool.history.utils import (
    calculate_diff,
    compose_create_description,
    compose_edit_description,
    compose_remove_description,
    derive_otu_information,
)


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
