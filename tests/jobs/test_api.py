import datetime

import arrow
import pytest

from syrupy.matchers import path_type
from virtool_core.models.enums import Permission
from virtool_core.models.job import JobState

from tests.fixtures.client import ClientSpawner
from virtool.fake.next import DataFaker
from virtool.mongo.core import Mongo

_job_response_matcher = path_type(
    {".*created_at": (str,), ".*key": (str,), ".*timestamp": (str,)}, regex=True
)


class TestFind:
    async def test_basic(
            self,
            fake2: DataFaker,
            snapshot,
            spawn_client: ClientSpawner,
    ):
        client = await spawn_client(authenticated=True)

        user_1 = await fake2.users.create()
        user_2 = await fake2.users.create()

        for _ in range(4):
            await fake2.jobs.create(user=user_1)

        for _ in range(7):
            await fake2.jobs.create(user=user_2)

        resp = await client.get("/jobs?per_page=5")

        assert resp.status == 200
        assert await resp.json() == snapshot(matcher=_job_response_matcher)

    @pytest.mark.parametrize("archived", [True, False])
    async def test_archived(
            self, archived: bool, fake2: DataFaker, snapshot, spawn_client: ClientSpawner
    ):
        """
        Test that jobs are filtered correctly when archived is ``true`` or ``false``.
        """
        client = await spawn_client(authenticated=True)

        user = await fake2.users.create()

        await fake2.jobs.create(user=user)
        await fake2.jobs.create(user=user, archived=True)
        await fake2.jobs.create(user=user)
        await fake2.jobs.create(user=user, archived=True)
        await fake2.jobs.create(user=user)

        resp = await client.get(f"/jobs?archived={archived}")
        body = await resp.json()

        assert resp.status == 200
        assert body == snapshot(matcher=_job_response_matcher)
        assert all(job["archived"] == archived for job in body["documents"])

    async def test_user(self, fake2: DataFaker, spawn_client: ClientSpawner):
        """
        Test that jobs are filtered correctly when user id(s) are provided.
        """
        client = await spawn_client(authenticated=True)

        user_1 = await fake2.users.create()
        user_2 = await fake2.users.create()
        user_3 = await fake2.users.create()

        await fake2.jobs.create(user=user_1)
        await fake2.jobs.create(user=user_2)
        await fake2.jobs.create(user=user_1)
        await fake2.jobs.create(user=user_2)
        await fake2.jobs.create(user=user_1)
        await fake2.jobs.create(user=user_3)

        resp_1 = await client.get(f"/jobs?user={user_1.id}")
        body_1 = await resp_1.json()

        assert resp_1.status == 200
        assert all(job["user"]["id"] == user_1.id for job in body_1["documents"])

        resp_2 = await client.get(f"/jobs?user={user_2.id}")
        body_2 = await resp_2.json()

        assert resp_2.status == 200
        assert all(job["user"]["id"] == user_2.id for job in body_2["documents"])

        resp_3 = await client.get(f"/jobs?user={user_1.id}&user={user_2.id}")
        body_3 = await resp_3.json()

        assert resp_3.status == 200
        assert all(
            job["user"]["id"] in [user_1.id, user_2.id] for job in body_3["documents"]
        )

    @pytest.mark.parametrize(
        "state",
        [
            "cancelled",
            "complete",
            "error",
            "preparing",
            "running",
            "terminated",
            "timeout",
            "waiting",
        ],
    )
    async def test_state(
            self, state: str, fake2: DataFaker, snapshot, spawn_client: ClientSpawner
    ):
        client = await spawn_client(authenticated=True)

        user_1 = await fake2.users.create()
        user_2 = await fake2.users.create()

        await fake2.jobs.create(user=user_1)
        await fake2.jobs.create(user=user_2, state=JobState.PREPARING)
        await fake2.jobs.create(user=user_2, state=JobState.RUNNING)
        await fake2.jobs.create(user=user_2)
        await fake2.jobs.create(user=user_1, state=JobState.WAITING)
        await fake2.jobs.create(user=user_1)
        await fake2.jobs.create(user=user_2, state=JobState.ERROR)
        await fake2.jobs.create(user=user_1, state=JobState.CANCELLED)
        await fake2.jobs.create(user=user_1, state=JobState.COMPLETE)
        await fake2.jobs.create(user=user_1)
        await fake2.jobs.create(user=user_2)
        await fake2.jobs.create(user=user_2, state=JobState.TERMINATED)
        await fake2.jobs.create(user=user_1, state=JobState.TIMEOUT)
        await fake2.jobs.create(user=user_1)

        resp = await client.get(f"/jobs?state={state}")
        body = await resp.json()

        assert resp.status == 200
        assert all(job["state"] == state for job in body["documents"])

    async def test_state_invalid(self, snapshot, spawn_client: ClientSpawner):
        """
        Test that a 400 error with a detailed message is returned when an invalid state
        value is provided.
        """
        client = await spawn_client(authenticated=True)

        resp = await client.get("/jobs?state=bad")

        assert resp.status == 400
        assert await resp.json() == snapshot


@pytest.mark.apitest
@pytest.mark.parametrize("error", [None, "404"])
async def test_get(error, fake2: DataFaker, snapshot, spawn_client):
    client = await spawn_client(authenticated=True)

    user = await fake2.users.create()

    job_id = "foo"

    if error is None:
        job = await fake2.jobs.create(user=user)
        job_id = job.id

    resp = await client.get(f"/jobs/{job_id}")
    body = await resp.json()

    if error is None:
        assert resp.status == 200
        assert body == snapshot(matcher=_job_response_matcher)

        # Explicitly ensure the secret API key is not returned in the response.
        assert "key" not in body
    else:
        assert resp.status == 404
        assert body == {
            "id": "not_found",
            "message": "Not found",
        }


class TestAcquire:
    async def test_ok(self, fake2: DataFaker, snapshot, spawn_job_client):
        """Test that a job can be acquired."""
        client = await spawn_job_client(authorize=True)

        job = await fake2.jobs.create(
            await fake2.users.create(), state=JobState.WAITING
        )

        resp = await client.patch(f"/jobs/{job.id}", json={"acquired": True})
        body = await resp.json()

        assert resp.status == 200
        assert body == snapshot(matcher=_job_response_matcher)
        assert "key" in body

    async def test_already_acquired(self, fake2: DataFaker, spawn_job_client):
        """Test that a 400 is returned when the job is already acquired."""
        client = await spawn_job_client(authorize=True)

        user = await fake2.users.create()
        job = await fake2.jobs.create(user, state=JobState.WAITING)

        resp = await client.patch(f"/jobs/{job.id}", json={"acquired": True})
        assert resp.status == 200

        resp = await client.patch(f"/jobs/{job.id}", json={"acquired": True})

        assert resp.status == 400
        assert await resp.json() == {
            "id": "bad_request",
            "message": "Job already acquired",
        }

    async def test_not_found(self, spawn_job_client):
        """Test that a 404 is returned when the job doesn't exist."""
        client = await spawn_job_client(authorize=True)

        resp = await client.patch("/jobs/foo", json={"acquired": True})

        assert resp.status == 404
        assert await resp.json() == {
            "id": "not_found",
            "message": "Not found",
        }


class TestArchive:
    async def test_ok(self, fake2: DataFaker, snapshot, spawn_client: ClientSpawner):
        """Test that a job can be archived."""
        client = await spawn_client(authenticated=True)

        job = await fake2.jobs.create(await fake2.users.create())

        resp = await client.patch(f"/jobs/{job.id}/archive", data={"archived": True})

        assert resp.status == 200
        assert await resp.json() == snapshot(matcher=_job_response_matcher)

    async def test_already_archived(
            self, fake2: DataFaker, spawn_client: ClientSpawner
    ):
        """Test that a 400 is returned when the job is already archived."""
        client = await spawn_client(authenticated=True)

        user = await fake2.users.create()
        job = await fake2.jobs.create(user, archived=True)

        resp = await client.patch(f"/jobs/{job.id}/archive", data={"archived": True})

        assert resp.status == 400
        assert await resp.json() == {
            "id": "bad_request",
            "message": "Job already archived",
        }

    async def test_not_found(self, spawn_client: ClientSpawner):
        """Test that a 404 is returned when the job doesn't exist."""
        client = await spawn_client(authenticated=True)

        resp = await client.patch("/jobs/foo/archive", data={"archived": True})

        assert resp.status == 404
        assert await resp.json() == {
            "id": "not_found",
            "message": "Not found",
        }


class TestPing:
    async def test_ok(self, fake2: DataFaker, spawn_job_client):
        """Test that a job can be pinged."""
        client = await spawn_job_client(authorize=True)

        job = await fake2.jobs.create(
            await fake2.users.create(), state=JobState.RUNNING
        )

        resp = await client.put(f"/jobs/{job.id}/ping")
        body = await resp.json()

        assert resp.status == 200

        assert len(body) == 1
        assert arrow.get(body["pinged_at"]) - arrow.utcnow() < datetime.timedelta(
            seconds=1
        )

    async def test_not_found(self, spawn_job_client):
        """Test that a 404 is returned when the job doesn't exist."""
        client = await spawn_job_client(authorize=True)

        resp = await client.put("/jobs/foo/ping", data={})

        assert resp.status == 404


@pytest.mark.apitest
@pytest.mark.parametrize(
    "error", [None, "not_found", "invalid_archived", "none_archived"]
)
async def test_bulk_archive(
        error,
        fake,
        resp_is,
        snapshot,
        spawn_client,
):
    client = await spawn_client(authenticated=True)

    message = ""

    jobs = [await fake.jobs.insert(randomize=True) for _ in range(10)]

    data = {
        "updates": [
            {"id": job["_id"], "archived": True}
            for job in jobs
            if job["archived"] is False
        ]
    }

    if error == "not_found":
        data["updates"].append({"id": "foo", "archived": True})
        data["updates"].append({"id": "bar", "archived": True})
        message += f"Jobs not found: {['foo', 'bar']}"
    elif error == "invalid_archived":
        data["updates"][0]["archived"] = False
    elif error == "none_archived":
        del data["updates"][1]["archived"]
    else:
        pass

    url = "/jobs?"

    resp = await client.patch(url, data=data)

    if error == "none_archived":
        assert resp.status == 400
        assert await resp.json() == [
            {
                "in": "body",
                "loc": ["updates", 1, "archived"],
                "msg": "field required",
                "type": "value_error.missing",
            }
        ]
        return

    if error == "invalid_archived":
        assert resp.status == 400
        assert await resp.json() == [
            {
                "loc": ["updates", 0, "archived"],
                "msg": "The `archived` field can only be `true`",
                "type": "value_error",
                "in": "body",
            }
        ]
        return

    if error == "not_found":
        await resp_is.bad_request(resp, message)
        return

    assert resp.status == 200

    body = await resp.json()

    assert body == snapshot


@pytest.mark.apitest
@pytest.mark.parametrize(
    "error", [None, 404, "409_complete", "409_errored", "409_cancelled"]
)
async def test_cancel(error, snapshot, mongo, fake2, resp_is, spawn_client, test_job):
    client = await spawn_client(authenticated=True, permissions=[Permission.cancel_job])

    user = await fake2.users.create()

    test_job["user"] = {"id": user.id}

    complete_status = test_job["status"].pop(-1)

    if error == "409_complete":
        test_job["status"].append(complete_status)

    if error == "409_cancelled":
        test_job["status"].append({**complete_status, "state": "cancelled"})

    if error == "409_errored":
        test_job["status"].append({**complete_status, "state": "errored"})

    if error != 404:
        await mongo.jobs.insert_one(test_job)

    resp = await client.put("/jobs/4c530449/cancel", {})

    if error == 404:
        await resp_is.not_found(resp)
        return

    if str(error).startswith("409"):
        await resp_is.conflict(resp, "Job cannot be cancelled in its current state")
        return

    assert resp.status == 200

    body = await resp.json()
    assert body == snapshot

    # Explicitly make sure the secret API key is not returned in the response
    assert "key" not in body


@pytest.mark.apitest
class TestPushStatus:
    @pytest.mark.parametrize("error", [None, 404, 409])
    async def test(
            self, error, fake2, snapshot, resp_is, mongo: Mongo, spawn_client, static_time, test_job
    ):
        client = await spawn_client(authenticated=True)

        user = await fake2.users.create()
        test_job["user"] = {"id": user.id}

        if error != 409:
            # Removes the last "completed" status entry, imitating a running job.
            del test_job["status"][-1]

        if error != 404:
            await mongo.jobs.insert_one(test_job)

        body = {"state": "running", "stage": "build", "progress": 23}

        resp = await client.post(f"/jobs/{test_job.id}/status", body)

        if error == 404:
            assert resp.status == 404
            return

        if error == 409:
            await resp_is.conflict(resp, "Job is finished")
            return

        assert resp.status == 201
        assert await resp.json() == snapshot

    async def test_name_and_description(
            self, fake2, snapshot, mongo: Mongo, spawn_client, static_time, test_job
    ):
        client = await spawn_client(authenticated=True)

        user = await fake2.users.create()
        test_job["user"] = {"id": user.id}

        del test_job["status"][-1]
        await mongo.jobs.insert_one(test_job)

        body = {
            "state": "running",
            "stage": "fastqc",
            "step_name": "FastQC",
            "step_description": "Run FastQC on the raw data",
            "progress": 14,
        }

        resp = await client.post(f"/jobs/{test_job.id}/status", body)

        assert resp.status == 201
        assert await resp.json() == snapshot

    async def test_bad_state(self, fake2, snapshot, mongo: Mongo, spawn_client, test_job):
        """
        Check that an unallowed state is rejected with 422.

        """
        client = await spawn_client(authenticated=True)

        user = await fake2.users.create()
        test_job["user"] = {"id": user.id}

        del test_job["status"][-1]
        await mongo.jobs.insert_one(test_job)

        body = {"state": "bad", "stage": "fastqc", "progress": 14}

        resp = await client.post(f"/jobs/{test_job.id}/status", body)

        assert resp.status == 422
        assert await resp.json() == snapshot

    @pytest.mark.parametrize(
        "error_type", ["KeyError", 3, None], ids=["valid", "invalid", "missing"]
    )
    @pytest.mark.parametrize(
        "traceback", ["Invalid", ["Valid"], None], ids=["valid", "invalid", "missing"]
    )
    @pytest.mark.parametrize(
        "details", ["Invalid", ["Valid"], None], ids=["valid", "invalid", "missing"]
    )
    async def test_error(
            self,
            error_type,
            traceback,
            details,
            fake2,
            snapshot,
            mongo: Mongo,
            spawn_client,
            static_time,
            test_job,
    ):
        """
        Ensure valid and invalid error inputs are handled correctly.

        """
        client = await spawn_client(authenticated=True)

        user = await fake2.users.create()
        test_job["user"] = {"id": user.id}

        del test_job["status"][-1]
        await mongo.jobs.insert_one(test_job)

        error = {}

        if error_type:
            error["type"] = error_type

        if traceback:
            error["traceback"] = traceback

        if details:
            error["details"] = details

        resp = await client.post(
            f"/jobs/{test_job.id}/status",
            {"error": error, "state": "error", "stage": "fastqc", "progress": 14},
        )

        assert (resp.status, await resp.json()) == snapshot

    async def test_missing_error(self, snapshot, mongo: Mongo, spawn_client, static_time, test_job):
        """
        Ensure and error is returned when state is set to `error`, but no error field is
        included.

        """
        client = await spawn_client(authenticated=True)

        del test_job["status"][-1]
        await mongo.jobs.insert_one(test_job)

        body = {"state": "error", "stage": "fastqc", "progress": 14}

        resp = await client.post(f"/jobs/{test_job.id}/status", body)

        assert (resp.status, await resp.json()) == snapshot

    @pytest.mark.parametrize("state", ["complete", "cancelled", "error", "terminated"])
    async def test_finalized_job_error(self, state, resp_is, mongo: Mongo, spawn_client, test_job):
        """
        Verify that job state cannot be updated once the latest status indicates the job is finished
        or otherwise terminated
        """
        client = await spawn_client(authenticated=True)

        test_job["status"][-1]["state"] = state
        await mongo.jobs.insert_one(test_job)

        body = {"state": "running", "stage": "build", "progress": 23}
        resp = await client.post(f"/jobs/{test_job.id}/status", body)

        await resp_is.conflict(resp, "Job is finished")
