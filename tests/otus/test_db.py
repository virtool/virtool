import pytest
from aiohttp.test_utils import make_mocked_coro

from virtool.otus.db import (
    check_name_and_abbreviation,
    check_sequence_segment,
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
    name, abbreviation, return_value, mongo, test_otu
):
    """Test that the function works properly for all possible inputs."""
    await mongo.otus.insert_one(test_otu)

    assert (
        await check_name_and_abbreviation(mongo, "hxn167", name, abbreviation)
        == return_value
    )


@pytest.mark.parametrize("in_db", [True, False])
@pytest.mark.parametrize("pass_document", [True, False])
async def test_join(
    in_db,
    pass_document,
    mocker,
    mongo,
    snapshot,
    test_otu,
    test_sequence,
):
    """Test that an OTU is properly joined when only a ``otu_id`` is provided."""
    await mongo.otus.insert_one(test_otu)
    await mongo.sequences.insert_one(test_sequence)

    m_find_one = mocker.patch.object(
        mongo.otus, "find_one", make_mocked_coro(test_otu if in_db else None)
    )

    kwargs = {"document": test_otu} if pass_document else {}

    joined = await join(mongo, "6116cba1", **kwargs)

    assert m_find_one.called != pass_document

    assert joined == snapshot(name="return")


async def test_increment_otu_version(mongo, snapshot):
    await mongo.otus.insert_one({"_id": "foo", "version": 3, "verified": True})
    await increment_otu_version(mongo, "foo")
    assert await mongo.otus.find_one() == snapshot


class TestCheckSequenceSegment:
    """Test that a sequence's segment is validated against the parent OTU's schema."""

    async def test_defined(self, mongo):
        await mongo.otus.insert_one({"_id": "foo", "schema": [{"name": "RNA1"}]})

        assert await check_sequence_segment(mongo, "foo", {"segment": "RNA1"}) is None

    async def test_not_defined(self, mongo):
        await mongo.otus.insert_one({"_id": "foo", "schema": [{"name": "RNA1"}]})

        assert (
            await check_sequence_segment(mongo, "foo", {"segment": "RNA2"})
            == "Segment RNA2 is not defined for the parent OTU"
        )

    async def test_no_segment(self, mongo):
        await mongo.otus.insert_one({"_id": "foo", "schema": [{"name": "RNA1"}]})

        assert await check_sequence_segment(mongo, "foo", {}) is None
