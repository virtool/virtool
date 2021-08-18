import pytest


@pytest.mark.parametrize("error", [None, "404"])
async def test_get(error, snapshot, spawn_client, test_job, resp_is):
    client = await spawn_client(authorize=True)

    if not error:
        await client.db.jobs.insert_one(test_job)

    resp = await client.get("/api/jobs/4c530449")

    if error:
        await resp_is.not_found(resp)
        return

    assert resp.status == 200

    body = await resp.json()
    snapshot.assert_match(body)
    assert "key" not in body


@pytest.mark.parametrize("error", [None, 404])
async def test_acquire(error, mocker, snapshot, dbi, test_job, spawn_client, resp_is):
    mocker.patch("virtool.utils.generate_key", return_value=("key", "hashed"))

    client = await spawn_client(authorize=True)

    if error == 404:
        test_job["acquired"] = True

    await dbi.jobs.insert_one(test_job)

    resp = await client.patch("/api/jobs/4c530449", {
        "acquired": True
    })

    if error == 404:
        await resp_is.bad_request(resp, "Job already acquired")
        return

    assert resp.status == 200

    body = await resp.json()

    snapshot.assert_match(body)
    assert "key" in body


async def test_cancel(snapshot, dbi, test_job, spawn_client):
    client = await spawn_client(authorize=True, permissions=["cancel_job"])

    test_job["status"].pop()

    await dbi.jobs.insert_one(test_job)

    resp = await client.put("/api/jobs/4c530449/cancel", {})

    assert resp.status == 200

    body = await resp.json()
    snapshot.assert_match(body)
    assert "key" not in body


@pytest.mark.parametrize("error", [
    None,
    404,
    409
])
async def test_push_status(error, resp_is, spawn_client, static_time, test_job):
    client = await spawn_client(authorize=True)

    if error != 409:
        # Removes the last "completed" status entry, imitating a running job.
        del test_job["status"][-1]

    if error != 404:
        await client.db.jobs.insert_one(test_job)

    body = {
        "state": "running",
        "stage": "build",
        "progress": 23
    }

    resp = await client.post(f"/api/jobs/{test_job.id}/status", body)

    if error == 404:
        assert resp.status == 404
        return

    if error == 409:
        await resp_is.conflict(resp, "Job is finished")
        return

    assert resp.status == 201

    assert await resp.json() == {
        "error": None,
        "progress": 23,
        "stage": "build",
        "state": "running",
        "timestamp": "2015-10-06T20:00:00Z"
    }
