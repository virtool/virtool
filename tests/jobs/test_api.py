import pytest


@pytest.mark.parametrize("error", [None, "404"])
async def test_get(error, snapshot, spawn_client, test_job, resp_is):
    client = await spawn_client(authorize=True)

    if not error:
        await client.db.jobs.insert_one(test_job)

    resp = await client.get("/api/jobs/4c530449")

    if error:
        assert await resp_is.not_found(resp)
        return

    assert resp.status == 200

    body = await resp.json()
    snapshot.assert_match(body)
    assert "key" not in body


async def test_cancel(snapshot, dbi, test_job, spawn_client):
    client = await spawn_client(authorize=True, permissions=["cancel_job"])

    test_job["status"].pop()

    await dbi.jobs.insert_one(test_job)

    resp = await client.put("/api/jobs/4c530449/cancel", {})

    assert resp.status == 200

    body = await resp.json()
    snapshot.assert_match(body)
    assert "key" not in body
