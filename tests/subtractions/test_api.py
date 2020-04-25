import aiohttp.test_utils
import pytest


@pytest.mark.parametrize("data", [
    {"name": "Bar"},
    {"nickname": "Bar Subtraction"},
    {"nickname": ""},
    {"name": "Bar", "nickname": "Bar Subtraction"}
])
async def test_edit(data, mocker, snapshot, spawn_client):
    mocker.patch("virtool.subtractions.db.get_linked_samples", aiohttp.test_utils.make_mocked_coro(12))

    client = client = await spawn_client(authorize=True, permissions=["modify_subtraction"])

    await client.db.subtraction.insert_one({
        "_id": "foo",
        "name": "Foo",
        "nickname": "Foo Subtraction"
    })

    resp = await client.patch("/api/subtractions/foo", data)

    assert resp.status == 200

    snapshot.assert_match(await resp.json(), "json")
    snapshot.assert_match(await client.db.subtraction.find_one(), "db")
