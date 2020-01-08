import pytest
from operator import itemgetter

import virtool.otus.db
import virtool.otus.utils
import virtool.history.utils


async def test_find(snapshot, spawn_client, test_changes, static_time):
    """
    Test that a list of processed change documents are returned with a ``200`` status.

    """
    client = await spawn_client(authorize=True)

    await client.db.history.insert_many(test_changes)

    resp = await client.get("/api/history")

    assert resp.status == 200

    resp_json = await resp.json()

    documents = sorted(resp_json["documents"], key=itemgetter("id"))

    snapshot.assert_match(documents)


@pytest.mark.parametrize("error", [None, "404"])
async def test_get(error, snapshot, resp_is, spawn_client, test_changes, static_time):
    """
    Test that a specific history change can be retrieved by its change_id.

    """
    client = await spawn_client(authorize=True)

    await client.db.history.insert_many(test_changes)

    change_id = "baz.1" if error else "6116cba1.1"

    resp = await client.get("/api/history/" + change_id)

    if error:
        assert await resp_is.not_found(resp)
        return

    assert resp.status == 200

    snapshot.assert_match(await resp.json(), "json")


@pytest.mark.parametrize("error", [None, "404"])
@pytest.mark.parametrize("remove", [False, True])
async def test_revert(error, remove, snapshot, create_mock_history, spawn_client, check_ref_right, resp_is):
    """
    Test that a valid request results in a reversion and a ``204`` response.

    """
    client = await spawn_client(authorize=True)

    await create_mock_history(remove)

    change_id = "foo.1" if error else "6116cba1.2"

    resp = await client.delete("/api/history/" + change_id)

    if error:
        assert await resp_is.not_found(resp)
        return

    if not check_ref_right:
        assert await resp_is.insufficient_rights(resp)
        return

    assert resp.status == 204

    snapshot.assert_match(await client.db.otus.find_one())
    snapshot.assert_match(await client.db.history.find().to_list(None))
    snapshot.assert_match(await client.db.sequences.find().to_list(None))
