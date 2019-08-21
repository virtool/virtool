import pytest
from copy import deepcopy
from aiohttp.test_utils import make_mocked_coro

import virtool.otus.db


@pytest.mark.parametrize("name,abbreviation,return_value", [
    ("Foobar Virus", "FBR", False),
    ("Prunus virus F", "FBR", "Name already exists"),
    ("Foobar Virus", "PVF", "Abbreviation already exists"),
    ("Prunus virus F", "PVF", "Name and abbreviation already exist"),
], ids=["name_exists", "abbreviation_exists", "both_exist", "neither exist"])
async def test_check_name_and_abbreviation(name, abbreviation, return_value, dbi, test_otu):
    """
    Test that the function works properly for all possible inputs.

    """
    await dbi.otus.insert_one(test_otu)

    result = await virtool.otus.db.check_name_and_abbreviation(dbi, "hxn167", name, abbreviation)

    assert result == return_value


@pytest.mark.parametrize("in_db", [True, False])
@pytest.mark.parametrize("pass_document", [True, False])
async def test_join(in_db, pass_document, mocker, dbi, test_otu, test_sequence, test_merged_otu):
    """
    Test that a otu is properly joined when only a ``otu_id`` is provided.

    """
    await dbi.otus.insert_one(test_otu)
    await dbi.sequences.insert_one(test_sequence)

    m_find_one = mocker.patch.object(
        dbi.otus,
        "find_one",
        make_mocked_coro(test_otu if in_db else None)
    )

    kwargs = dict(document=test_otu) if pass_document else dict()

    joined = await virtool.otus.db.join(dbi, "6116cba1", **kwargs)

    assert m_find_one.called != pass_document

    if in_db or (not in_db and pass_document):
        assert joined == test_merged_otu
    else:
        assert joined is None


async def test_update_last_indexed_version(dbi, test_otu):
    """
    Test that function works as expected.

    """
    otu_1 = test_otu
    otu_2 = deepcopy(test_otu)

    otu_2.update({
        "_id": "foobar"
    })

    await dbi.otus.insert_many([otu_1, otu_2])

    await virtool.otus.db.update_last_indexed_version(dbi, ["foobar"], 5)

    otu_1 = await dbi.otus.find_one({"_id": "6116cba1"})
    otu_2 = await dbi.otus.find_one({"_id": "foobar"})

    assert otu_1["version"] == 0
    assert otu_1["last_indexed_version"] == 0

    assert otu_2["version"] == 5
    assert otu_2["last_indexed_version"] == 5

