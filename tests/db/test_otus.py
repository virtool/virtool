import pytest
from copy import deepcopy
from aiohttp.test_utils import make_mocked_coro

import virtool.db.otus


@pytest.mark.parametrize("name,abbreviation,return_value", [
    ("Foobar Virus", "FBR", False),
    ("Prunus virus F", "FBR", "Name already exists"),
    ("Foobar Virus", "PVF", "Abbreviation already exists"),
    ("Prunus virus F", "PVF", "Name and abbreviation already exist"),
], ids=["name_exists", "abbreviation_exists", "both_exist", "neither exist"])
async def test_check_name_and_abbreviation(name, abbreviation, return_value, test_motor, test_otu):
    """
    Test that the function works properly for all possible inputs.

    """
    await test_motor.otus.insert_one(test_otu)

    result = await virtool.db.otus.check_name_and_abbreviation(test_motor, name, abbreviation)

    assert result == return_value


@pytest.mark.parametrize("excluded", [True, False])
@pytest.mark.parametrize("exists", [True, False])
async def test_get_new_isolate_id(excluded, exists, mocker, test_motor, test_otu):
    if exists:
        test_otu["isolates"].append({
            "id": "baz"
        })

    await test_motor.otus.insert(test_otu)

    m = mocker.patch("virtool.utils.random_alphanumeric", return_value="foobar")

    kwargs = dict(excluded=["foo"]) if excluded else dict()

    assert await virtool.db.otus.get_new_isolate_id(test_motor, **kwargs) == "foobar"

    if excluded and exists:
        m.assert_called_with(8, excluded=["baz", "cab8b360", "foo"])

    elif excluded:
        m.assert_called_with(8, excluded=["cab8b360", "foo"])

    elif exists:
        m.assert_called_with(8, excluded=["baz", "cab8b360"])

    else:
        m.assert_called_with(8, excluded=["cab8b360"])


@pytest.mark.parametrize("in_db", [True, False])
@pytest.mark.parametrize("pass_document", [True, False])
async def test_join(in_db, pass_document, mocker, test_motor, test_otu, test_sequence, test_merged_otu):
    """
    Test that a otu is properly joined when only a ``otu_id`` is provided.

    """
    m = make_mocked_coro(test_otu if in_db else None)

    mocker.patch("motor.motor_asyncio.AsyncIOMotorCollection.find_one", m)

    await test_motor.otus.insert(test_otu)
    await test_motor.sequences.insert(test_sequence)

    kwargs = dict(document=test_otu) if pass_document else dict()

    joined = await virtool.db.otus.join(test_motor, "6116cba1", **kwargs)

    assert m.called != pass_document

    if in_db or (not in_db and pass_document):
        assert joined == test_merged_otu
    else:
        assert joined is None


async def test_update_last_indexed_version(test_motor, test_otu):
    """
    Test that function works as expected.

    """
    otu_1 = test_otu
    otu_2 = deepcopy(test_otu)

    otu_2.update({
        "_id": "foobar"
    })

    await test_motor.otus.insert_many([otu_1, otu_2])

    await virtool.db.otus.update_last_indexed_version(test_motor, ["foobar"], 5)

    otu_1 = await test_motor.otus.find_one({"_id": "6116cba1"})
    otu_2 = await test_motor.otus.find_one({"_id": "foobar"})

    assert otu_1["version"] == 0
    assert otu_1["last_indexed_version"] == 0

    assert otu_2["version"] == 5
    assert otu_2["last_indexed_version"] == 5

