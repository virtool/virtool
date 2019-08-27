import pytest
from aiohttp.test_utils import make_mocked_coro


@pytest.mark.parametrize("deleted_count", [0, 1])
@pytest.mark.parametrize("permitted", [True, False])
async def test_remove(deleted_count, permitted, mocker, spawn_client, resp_is):
    permissions = ["remove_file"] if permitted else []

    client = await spawn_client(authorize=True, permissions=permissions)

    m_remove = mocker.patch("virtool.files.db.remove", make_mocked_coro(deleted_count))

    resp = await client.delete("/api/files/foo-test.fq.gz")

    if not permitted:
        assert await resp_is.not_permitted(resp)
        assert not m_remove.called
        return

    m_remove.assert_called_with(
        client.app["db"],
        client.app["settings"],
        client.app["run_in_thread"],
        "foo-test.fq.gz"
    )

    if deleted_count == 0:
        assert await resp_is.not_found(resp)
        return

    assert resp.status == 200

    assert await resp.json() == {
        "file_id": "foo-test.fq.gz",
        "removed": True
    }


