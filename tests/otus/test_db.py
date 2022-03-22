import pytest
from aiohttp.test_utils import make_mocked_coro

from virtool.otus.db import (
    check_name_and_abbreviation,
    check_sequence_segment_or_target,
    increment_otu_version,
    join,
)


@pytest.mark.parametrize(
    "name,abbreviation,return_value",
    [
        ("Foobar Virus", "FBR", None),
        ("Prunus virus F", "FBR", "Name already exists"),
        ("Foobar Virus", "PVF", "Abbreviation already exists"),
        ("Prunus virus F", "PVF", "Name and abbreviation already exist"),
    ],
    ids=["name_exists", "abbreviation_exists", "both_exist", "neither exist"],
)
async def test_check_name_and_abbreviation(
    name, abbreviation, return_value, dbi, test_otu
):
    """
    Test that the function works properly for all possible inputs.

    """
    await dbi.otus.insert_one(test_otu)

    assert (
        await check_name_and_abbreviation(dbi, "hxn167", name, abbreviation)
        == return_value
    )


@pytest.mark.parametrize("in_db", [True, False])
@pytest.mark.parametrize("pass_document", [True, False])
async def test_join(
    in_db, pass_document, mocker, dbi, test_otu, test_sequence, test_merged_otu
):
    """
    Test that an OTU is properly joined when only a ``otu_id`` is provided.

    """
    await dbi.otus.insert_one(test_otu)
    await dbi.sequences.insert_one(test_sequence)

    m_find_one = mocker.patch.object(
        dbi.otus, "find_one", make_mocked_coro(test_otu if in_db else None)
    )

    kwargs = {"document": test_otu} if pass_document else {}

    joined = await join(dbi, "6116cba1", **kwargs)

    assert m_find_one.called != pass_document

    if in_db or (not in_db and pass_document):
        assert joined == test_merged_otu
    else:
        assert joined is None


async def test_increment_otu_version(dbi, snapshot):
    await dbi.otus.insert_one({"_id": "foo", "version": 3, "verified": True})
    await increment_otu_version(dbi, "foo")
    assert await dbi.otus.find_one() == snapshot


@pytest.mark.parametrize("data_type", ["genome", "barcode"])
@pytest.mark.parametrize("defined", [True, False])
@pytest.mark.parametrize("missing", [True, False])
@pytest.mark.parametrize("used", [True, False])
@pytest.mark.parametrize("sequence_id", ["boo", "bad", None])
async def test_check_segment_or_target(
    data_type, defined, missing, used, sequence_id, dbi
):
    """
    Test that issues with `segment` or `target` fields in sequence editing requests are
    detected.

    """
    await dbi.otus.insert_one({"_id": "foo", "schema": [{"name": "RNA1"}]})

    await dbi.references.insert_one(
        {"_id": "bar", "data_type": data_type, "targets": [{"name": "CPN60"}]}
    )

    await dbi.sequences.insert_one(
        {
            "_id": "boo",
            "otu_id": "foo",
            "isolate_id": "baz",
            "target": "CPN60" if used else "ITS2",
        }
    )

    data = dict()

    if data_type == "barcode":
        data["target"] = "CPN60" if defined else "ITS2"
    else:
        data["segment"] = "RNA1" if defined else "RNA2"

    if missing:
        data = dict()

    message = await check_sequence_segment_or_target(
        dbi, "foo", "baz", sequence_id, "bar", data
    )

    # The only case where an error message should be returned for a genome-type
    # reference.
    if data_type == "genome" and not missing and not defined:
        assert message == "Segment RNA2 is not defined for the parent OTU"
        return

    if data_type == "barcode":
        if sequence_id is None and missing:
            assert message == "The 'target' field is required for barcode references"
            return

        if not missing and not defined:
            assert message == "Target ITS2 is not defined for the parent reference"
            return

        if sequence_id != "boo" and not missing and used and data_type == "barcode":
            assert message == "Target CPN60 is already used in isolate baz"
            return

    assert message is None
