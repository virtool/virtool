import datetime
from http import HTTPStatus

import arrow
import pytest
from syrupy import SnapshotAssertion
from syrupy.matchers import path_type

from tests.fixtures.client import ClientSpawner, JobClientSpawner
from tests.fixtures.response import RespIs
from virtool.fake.next import DataFaker
from virtool.jobs.models import JobState
from virtool.models.enums import Permission
from virtool.mongo.core import Mongo

_job_response_matcher = path_type(
    {
        ".*created_at": (str,),
        ".*key": (str,),
        ".*pinged_at": (str,),
        ".*timestamp": (str,),
    },
    regex=True,
)


class TestFind:
    async def test_basic(
        self,
        fake: DataFaker,
        snapshot: SnapshotAssertion,
        spawn_client: ClientSpawner,
    ):
        client = await spawn_client(authenticated=True)

        user_1 = await fake.users.create()
        user_2 = await fake.users.create()

        for _ in range(4):
            await fake.jobs.create(user=user_1)

        for _ in range(7):
            await fake.jobs.create(user=user_2)

        resp = await client.get("/jobs?per_page=5")

        assert resp.status == HTTPStatus.OK
        assert await resp.json() == snapshot(matcher=_job_response_matcher)

    async def test_user(self, fake: DataFaker, spawn_client: ClientSpawner):
        """Test that jobs are filtered correctly when user id(s) are provided."""
        client = await spawn_client(authenticated=True)

        user_1 = await fake.users.create()
        user_2 = await fake.users.create()
        user_3 = await fake.users.create()

        await fake.jobs.create(user=user_1)
        await fake.jobs.create(user=user_2)
        await fake.jobs.create(user=user_1)
        await fake.jobs.create(user=user_2)
        await fake.jobs.create(user=user_1)
        await fake.jobs.create(user=user_3)

        resp_1 = await client.get(f"/jobs?user={user_1.id}")
        body_1 = await resp_1.json()

        assert resp_1.status == HTTPStatus.OK
        assert all(job["user"]["id"] == user_1.id for job in body_1["documents"])

        resp_2 = await client.get(f"/jobs?user={user_2.id}")
        body_2 = await resp_2.json()

        assert resp_2.status == HTTPStatus.OK
        assert all(job["user"]["id"] == user_2.id for job in body_2["documents"])

        resp_3 = await client.get(f"/jobs?user={user_1.id}&user={user_2.id}")
        body_3 = await resp_3.json()

        assert resp_3.status == HTTPStatus.OK
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
        self,
        state: str,
        fake: DataFaker,
        snapshot,
        spawn_client: ClientSpawner,
    ):
        client = await spawn_client(authenticated=True)

        user_1 = await fake.users.create()
        user_2 = await fake.users.create()

        await fake.jobs.create(user=user_1)
        await fake.jobs.create(user=user_2, state=JobState.PREPARING)
        await fake.jobs.create(user=user_2, state=JobState.RUNNING)
        await fake.jobs.create(user=user_2)
        await fake.jobs.create(user=user_1, state=JobState.WAITING)
        await fake.jobs.create(user=user_1)
        await fake.jobs.create(user=user_2, state=JobState.ERROR)
        await fake.jobs.create(user=user_1, state=JobState.CANCELLED)
        await fake.jobs.create(user=user_1, state=JobState.COMPLETE)
        await fake.jobs.create(user=user_1)
        await fake.jobs.create(user=user_2)
        await fake.jobs.create(user=user_2, state=JobState.TERMINATED)
        await fake.jobs.create(user=user_1, state=JobState.TIMEOUT)
        await fake.jobs.create(user=user_1)

        resp = await client.get(f"/jobs?state={state}")
        body = await resp.json()

        assert resp.status == HTTPStatus.OK
        assert all(job["state"] == state for job in body["documents"])

    async def test_state_invalid(self, snapshot, spawn_client: ClientSpawner):
        """Test that a 400 error with a detailed message is returned when an invalid state
        value is provided.
        """
        client = await spawn_client(authenticated=True)

        resp = await client.get("/jobs?state=bad")

        assert resp.status == 400
        assert await resp.json() == snapshot


@pytest.mark.parametrize("error", [None, "404"])
async def test_get(error, fake: DataFaker, snapshot, spawn_client):
    client = await spawn_client(authenticated=True)

    user = await fake.users.create()

    job_id = "foo"

    if error is None:
        job = await fake.jobs.create(user=user)
        job_id = job.id

    resp = await client.get(f"/jobs/{job_id}")
    body = await resp.json()

    if error is None:
        assert resp.status == HTTPStatus.OK
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
    async def test_ok(
        self,
        fake: DataFaker,
        snapshot: SnapshotAssertion,
        spawn_job_client: JobClientSpawner,
    ):
        """Test that a job can be acquired."""
        client = await spawn_job_client(authenticated=True)

        job = await fake.jobs.create(
            await fake.users.create(),
            state=JobState.WAITING,
        )

        resp = await client.patch(f"/jobs/{job.id}", json={"acquired": True})
        body = await resp.json()

        assert resp.status == HTTPStatus.OK
        assert body == snapshot(matcher=_job_response_matcher)
        assert "key" in body

    async def test_already_acquired(self, fake: DataFaker, spawn_job_client):
        """Test that a 400 is returned when the job is already acquired."""
        client = await spawn_job_client(authenticated=True)

        user = await fake.users.create()
        job = await fake.jobs.create(user, state=JobState.WAITING)

        resp = await client.patch(f"/jobs/{job.id}", json={"acquired": True})
        assert resp.status == HTTPStatus.OK

        resp = await client.patch(f"/jobs/{job.id}", json={"acquired": True})

        assert resp.status == 400
        assert await resp.json() == {
            "id": "bad_request",
            "message": "Job already acquired",
        }

    async def test_not_found(self, spawn_job_client):
        """Test that a 404 is returned when the job doesn't exist."""
        client = await spawn_job_client(authenticated=True)

        resp = await client.patch("/jobs/foo", json={"acquired": True})

        assert resp.status == 404
        assert await resp.json() == {
            "id": "not_found",
            "message": "Not found",
        }

    @pytest.mark.parametrize(
        "state",
        [
            JobState.COMPLETE,
            JobState.ERROR,
            JobState.CANCELLED,
            JobState.TERMINATED,
            JobState.TIMEOUT,
        ],
    )
    async def test_status_conflict(
        self,
        state: JobState,
        fake: DataFaker,
        spawn_job_client,
    ):
        """Test that a 409 is returned when trying to acquire a job in a terminal state."""
        client = await spawn_job_client(authenticated=True)

        user = await fake.users.create()
        job = await fake.jobs.create(user, state=state)

        resp = await client.patch(f"/jobs/{job.id}", json={"acquired": True})

        assert resp.status == 409


class TestPing:
    async def test_ok(self, fake: DataFaker, spawn_job_client):
        """Test that a job can be pinged."""
        client = await spawn_job_client(authenticated=True)

        job = await fake.jobs.create(
            await fake.users.create(),
            state=JobState.RUNNING,
        )

        resp = await client.put(f"/jobs/{job.id}/ping")
        body = await resp.json()

        assert resp.status == HTTPStatus.OK

        assert len(body) == 1
        assert arrow.get(body["pinged_at"]) - arrow.utcnow() < datetime.timedelta(
            seconds=1,
        )

    async def test_not_found(self, spawn_job_client):
        """Test that a 404 is returned when the job doesn't exist."""
        client = await spawn_job_client(authenticated=True)

        resp = await client.put("/jobs/foo/ping", data={})

        assert resp.status == 404


@pytest.mark.parametrize(
    "error",
    [None, 404, "409_complete", "409_errored", "409_cancelled"],
)
async def test_cancel(
    error,
    fake: DataFaker,
    mongo: Mongo,
    resp_is: RespIs,
    snapshot: SnapshotAssertion,
    spawn_client: ClientSpawner,
    test_job,
):
    client = await spawn_client(authenticated=True, permissions=[Permission.cancel_job])

    user = await fake.users.create()

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

    assert resp.status == HTTPStatus.OK

    body = await resp.json()
    assert body == snapshot

    # Explicitly make sure the secret API key is not returned in the response
    assert "key" not in body


class TestPushStatus:
    @pytest.mark.parametrize("error", [None, 404, 409])
    async def test(
        self,
        error,
        fake: DataFaker,
        snapshot,
        resp_is,
        mongo: Mongo,
        spawn_client,
        static_time,
        test_job,
    ):
        client = await spawn_client(authenticated=True)

        user = await fake.users.create()
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
        self,
        fake: DataFaker,
        snapshot,
        mongo: Mongo,
        spawn_client,
        static_time,
        test_job,
    ):
        client = await spawn_client(authenticated=True)

        user = await fake.users.create()
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

    async def test_bad_state(
        self,
        fake: DataFaker,
        snapshot,
        mongo: Mongo,
        spawn_client,
        test_job,
    ):
        """Check that an unallowed state is rejected with 422."""
        client = await spawn_client(authenticated=True)

        user = await fake.users.create()
        test_job["user"] = {"id": user.id}

        del test_job["status"][-1]
        await mongo.jobs.insert_one(test_job)

        body = {"state": "bad", "stage": "fastqc", "progress": 14}

        resp = await client.post(f"/jobs/{test_job.id}/status", body)

        assert resp.status == 422
        assert await resp.json() == snapshot

    @pytest.mark.parametrize(
        "error_type",
        ["KeyError", 3, None],
        ids=["valid", "invalid", "missing"],
    )
    @pytest.mark.parametrize(
        "traceback",
        ["Invalid", ["Valid"], None],
        ids=["valid", "invalid", "missing"],
    )
    @pytest.mark.parametrize(
        "details",
        ["Invalid", ["Valid"], None],
        ids=["valid", "invalid", "missing"],
    )
    async def test_error(
        self,
        error_type,
        traceback,
        details,
        fake: DataFaker,
        snapshot,
        mongo: Mongo,
        spawn_client,
        static_time,
        test_job,
    ):
        """Ensure valid and invalid error inputs are handled correctly."""
        client = await spawn_client(authenticated=True)

        user = await fake.users.create()
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

    async def test_missing_error(
        self,
        snapshot,
        mongo: Mongo,
        spawn_client,
        static_time,
        test_job,
    ):
        """Ensure and error is returned when state is set to `error`, but no error field is
        included.

        """
        client = await spawn_client(authenticated=True)

        del test_job["status"][-1]
        await mongo.jobs.insert_one(test_job)

        body = {"state": "error", "stage": "fastqc", "progress": 14}

        resp = await client.post(f"/jobs/{test_job.id}/status", body)

        assert (resp.status, await resp.json()) == snapshot

    @pytest.mark.parametrize("state", ["complete", "cancelled", "error", "terminated"])
    async def test_finalized_job_error(
        self,
        state,
        resp_is,
        mongo: Mongo,
        spawn_client,
        test_job,
    ):
        """Verify that job state cannot be updated once the latest status indicates the job is finished
        or otherwise terminated
        """
        client = await spawn_client(authenticated=True)

        test_job["status"][-1]["state"] = state
        await mongo.jobs.insert_one(test_job)

        body = {"state": "running", "stage": "build", "progress": 23}
        resp = await client.post(f"/jobs/{test_job.id}/status", body)

        await resp_is.conflict(resp, "Job is finished")
