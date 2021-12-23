import pytest


@pytest.mark.parametrize("error", [None, "404"])
async def test_get(error, fake, snapshot, spawn_client, test_job, resp_is):
    client = await spawn_client(authorize=True)

    user = await fake.users.insert()

    test_job["user"] = {
        "id": user["_id"]
    }

    if not error:
        await client.db.jobs.insert_one(test_job)

    resp = await client.get("/jobs/4c530449")

    if error:
        await resp_is.not_found(resp)
        return

    assert resp.status == 200

    body = await resp.json()
    assert body == snapshot

    # Explicitly make sure the secret API key is not returned in the response
    assert "key" not in body


@pytest.mark.parametrize("error", [None, 400, 404])
async def test_acquire(error, mocker, snapshot, dbi, fake, test_job, spawn_client, resp_is):
    mocker.patch("virtool.utils.generate_key", return_value=("key", "hashed"))

    user = await fake.users.insert()

    test_job["user"] = {
        "id": user["_id"]
    }

    client = await spawn_client(authorize=True)

    if error == 400:
        test_job["acquired"] = True

    if error != 404:
        await dbi.jobs.insert_one(test_job)

    resp = await client.patch("/jobs/4c530449", {
        "acquired": True
    })

    if error == 400:
        await resp_is.bad_request(resp, "Job already acquired")
        return

    if error == 404:
        await resp_is.not_found(resp)
        return

    assert resp.status == 200

    body = await resp.json()
    assert body == snapshot

    # Explicitly make sure the API key IS in the body.
    assert "key" in body


@pytest.mark.parametrize("error", [None, 404, "409_complete", "409_errored", "409_cancelled"])
async def test_cancel(error, snapshot, dbi, fake, resp_is, spawn_client, test_job):
    client = await spawn_client(authorize=True, permissions=["cancel_job"])

    user = await fake.users.insert()

    test_job["user"] = {
        "id": user["_id"]
    }

    complete_status = test_job["status"].pop(-1)

    if error == "409_complete":
        test_job["status"].append(complete_status)

    if error == "409_cancelled":
        test_job["status"].append({
            **complete_status,
            "state": "cancelled"
        })

    if error == "409_errored":
        test_job["status"].append({
            **complete_status,
            "state": "errored"
        })

    if error != 404:
        await dbi.jobs.insert_one(test_job)

    resp = await client.put("/jobs/4c530449/cancel", {})

    if error == 404:
        await resp_is.not_found(resp)
        return

    if str(error).startswith("409"):
        await resp_is.conflict(resp, "Not cancellable")
        return

    assert resp.status == 200

    body = await resp.json()
    assert body == snapshot

    # Explicitly make sure the secret API key is not returned in the response
    assert "key" not in body


class TestPushStatus:

    @pytest.mark.parametrize("error", [
        None,
        404,
        409
    ])
    async def test(self, error, snapshot, resp_is, spawn_client, static_time, test_job):
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

        resp = await client.post(f"/jobs/{test_job.id}/status", body)

        if error == 404:
            assert resp.status == 404
            return

        if error == 409:
            await resp_is.conflict(resp, "Job is finished")
            return

        assert resp.status == 201
        assert await resp.json() == snapshot

    async def test_name_and_description(self, snapshot, spawn_client, static_time, test_job):
        client = await spawn_client(authorize=True)

        del test_job["status"][-1]
        await client.db.jobs.insert_one(test_job)

        body = {
            "state": "running",
            "stage": "fastqc",
            "step_name": "FastQC",
            "step_description": "Run FastQC on the raw data",
            "progress": 14
        }

        resp = await client.post(f"/jobs/{test_job.id}/status", body)

        assert resp.status == 201
        assert await resp.json() == snapshot

    async def test_bad_state(self, snapshot, spawn_client, test_job):
        """
        Check that an unallowed state is rejected with 422.

        """
        client = await spawn_client(authorize=True)

        del test_job["status"][-1]
        await client.db.jobs.insert_one(test_job)

        body = {
            "state": "bad",
            "stage": "fastqc",
            "progress": 14
        }

        resp = await client.post(f"/jobs/{test_job.id}/status", body)

        assert resp.status == 422
        assert await resp.json() == snapshot

    @pytest.mark.parametrize("error_type", ["KeyError", 3, None], ids=["valid", "invalid", "missing"])
    @pytest.mark.parametrize("traceback", ["Invalid", ["Valid"], None], ids=["valid", "invalid", "missing"])
    @pytest.mark.parametrize("details", ["Invalid", ["Valid"], None], ids=["valid", "invalid", "missing"])
    async def test_error(self, error_type, traceback, details, snapshot, spawn_client, static_time, test_job):
        """
        Ensure valid and invalid error inputs are handled correctly.

        """
        client = await spawn_client(authorize=True)

        del test_job["status"][-1]
        await client.db.jobs.insert_one(test_job)

        error = {}

        if error_type:
            error["type"] = error_type

        if traceback:
            error["traceback"] = traceback

        if details:
            error["details"] = details

        body = {
            "error": error,
            "state": "error",
            "stage": "fastqc",
            "progress": 14
        }

        resp = await client.post(f"/jobs/{test_job.id}/status", body)

        assert (resp.status, await resp.json()) == snapshot

    async def test_missing_error(self, snapshot, spawn_client, static_time, test_job):
        """
        Ensure and error is returned when state is set to `error`, but no error field is included.

        """
        client = await spawn_client(authorize=True)

        del test_job["status"][-1]
        await client.db.jobs.insert_one(test_job)

        body = {
            "state": "error",
            "stage": "fastqc",
            "progress": 14
        }

        resp = await client.post(f"/jobs/{test_job.id}/status", body)

        assert (resp.status, await resp.json()) == snapshot
