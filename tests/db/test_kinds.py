import pytest
from copy import deepcopy
from aiohttp.test_utils import make_mocked_coro

import virtool.db.kinds


@pytest.mark.parametrize("name,abbreviation,return_value", [
    ("Foobar Virus", "FBR", False),
    ("Prunus virus F", "FBR", "Name already exists"),
    ("Foobar Virus", "PVF", "Abbreviation already exists"),
    ("Prunus virus F", "PVF", "Name and abbreviation already exist"),
], ids=["name_exists", "abbreviation_exists", "both_exist", "neither exist"])
async def test_check_name_and_abbreviation(name, abbreviation, return_value, test_motor, test_kind):
    """
    Test that the function works properly for all possible inputs.

    """
    await test_motor.kinds.insert_one(test_kind)

    result = await virtool.db.kinds.check_name_and_abbreviation(test_motor, name, abbreviation)

    assert result == return_value


@pytest.mark.parametrize("excluded", [True, False])
@pytest.mark.parametrize("exists", [True, False])
async def test_get_new_isolate_id(excluded, exists, mocker, test_motor, test_kind):
    if exists:
        test_kind["isolates"].append({
            "id": "baz"
        })

    await test_motor.kinds.insert(test_kind)

    m = mocker.patch("virtool.utils.random_alphanumeric", return_value="foobar")

    kwargs = dict(excluded=["foo"]) if excluded else dict()

    assert await virtool.db.kinds.get_new_isolate_id(test_motor, **kwargs) == "foobar"

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
async def test_join(in_db, pass_document, mocker, test_motor, test_kind, test_sequence, test_merged_kind):
    """
    Test that a kind is properly joined when only a ``kind_id`` is provided.

    """
    m = make_mocked_coro(test_kind if in_db else None)

    mocker.patch("motor.motor_asyncio.AsyncIOMotorCollection.find_one", m)

    await test_motor.kinds.insert(test_kind)
    await test_motor.sequences.insert(test_sequence)

    kwargs = dict(document=test_kind) if pass_document else dict()

    joined = await virtool.db.kinds.join(test_motor, "6116cba1", **kwargs)

    assert m.called != pass_document

    if in_db or (not in_db and pass_document):
        assert joined == test_merged_kind
    else:
        assert joined is None


async def test_update_last_indexed_version(test_motor, test_kind):
    """
    Test that function works as expected.

    """
    kind_1 = test_kind
    kind_2 = deepcopy(test_kind)

    kind_2.update({
        "_id": "foobar"
    })

    await test_motor.kinds.insert_many([kind_1, kind_2])

    await virtool.db.kinds.update_last_indexed_version(test_motor, ["foobar"], 5)

    kind_1 = await test_motor.kinds.find_one({"_id": "6116cba1"})
    kind_2 = await test_motor.kinds.find_one({"_id": "foobar"})

    assert kind_1["version"] == 0
    assert kind_1["last_indexed_version"] == 0

    assert kind_2["version"] == 5
    assert kind_2["last_indexed_version"] == 5

