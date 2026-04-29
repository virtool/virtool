import datetime
from http import HTTPStatus
from types import NoneType

import arrow
import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from syrupy import SnapshotAssertion
from syrupy.matchers import path_type

from tests.fixtures.client import ClientSpawner, JobClientSpawner
from tests.fixtures.response import RespIs
from virtool.fake.next import DataFaker
from virtool.jobs.models import JobState
from virtool.jobs.pg import SQLJob
from virtool.models.enums import Permission

_job_response_matcher = path_type(
    {
        ".*claimed_at": (str, NoneType),
        ".*created_at": (str,),
        ".*finished_at": (str, NoneType),
        ".*key": (str,),
        ".*pinged_at": (str, NoneType),
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
        assert all(job["user"]["id"] == user_1.id for job in body_1["items"])

        resp_2 = await client.get(f"/jobs?user={user_2.id}")
        body_2 = await resp_2.json()

        assert resp_2.status == HTTPStatus.OK
        assert all(job["user"]["id"] == user_2.id for job in body_2["items"])

        resp_3 = await client.get(f"/jobs?user={user_1.id}&user={user_2.id}")
        body_3 = await resp_3.json()

        assert resp_3.status == HTTPStatus.OK
        assert all(
            job["user"]["id"] in [user_1.id, user_2.id] for job in body_3["items"]
        )

    @pytest.mark.parametrize(
        "state",
        [
            "cancelled",
            "failed",
            "pending",
            "running",
            "succeeded",
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

        await fake.jobs.create(user=user_1, state=JobState.PENDING)
        await fake.jobs.create(user=user_2, state=JobState.RUNNING)
        await fake.jobs.create(user=user_2, state=JobState.RUNNING)
        await fake.jobs.create(user=user_1, state=JobState.PENDING)
        await fake.jobs.create(user=user_2, state=JobState.FAILED)
        await fake.jobs.create(user=user_1, state=JobState.CANCELLED)
        await fake.jobs.create(user=user_1, state=JobState.SUCCEEDED)
        await fake.jobs.create(user=user_2, state=JobState.FAILED)
        await fake.jobs.create(user=user_1, state=JobState.SUCCEEDED)

        resp = await client.get(f"/jobs?state={state}")
        body = await resp.json()

        assert resp.status == HTTPStatus.OK
        assert all(job["state"] == state for job in body["items"])

    async def test_state_invalid(self, snapshot, spawn_client: ClientSpawner):
        """Test that a 400 error with a detailed message is returned when an invalid state
        value is provided.
        """
        client = await spawn_client(authenticated=True)

        resp = await client.get("/jobs?state=bad")

        assert resp.status == 400
        assert await resp.json() == snapshot


class TestGetCounts:
    async def test_ok(self, fake: DataFaker, spawn_client: ClientSpawner):
        client = await spawn_client(authenticated=True)

        user = await fake.users.create()

        await fake.jobs.create(user=user, state=JobState.PENDING, workflow="nuvs")
        await fake.jobs.create(user=user, state=JobState.PENDING, workflow="nuvs")
        await fake.jobs.create(user=user, state=JobState.RUNNING, workflow="pathoscope")
        await fake.jobs.create(user=user, state=JobState.SUCCEEDED, workflow="nuvs")

        resp = await client.get("/jobs/counts")

        assert resp.status == HTTPStatus.OK

        body = await resp.json()

        assert body["pending"]["nuvs"] == 2
        assert body["running"]["pathoscope"] == 1
        assert body["succeeded"]["nuvs"] == 1

        assert sum(c for counts in body.values() for c in counts.values()) == 4

    async def test_empty(self, spawn_client: ClientSpawner):
        client = await spawn_client(authenticated=True)

        resp = await client.get("/jobs/counts")

        assert resp.status == HTTPStatus.OK

        body = await resp.json()

        assert sum(c for counts in body.values() for c in counts.values()) == 0


@pytest.mark.parametrize("error", [None, "404"])
async def test_get(error, fake: DataFaker, snapshot, spawn_client):
    client = await spawn_client(authenticated=True)

    user = await fake.users.create()

    if error is None:
        job = await fake.jobs.create(user=user)
        resp = await client.get(f"/jobs/{job.id}")
        body = await resp.json()

        assert resp.status == HTTPStatus.OK
        assert body == snapshot(matcher=_job_response_matcher)

        # Explicitly ensure the secret API key is not returned in the response.
        assert "key" not in body
    else:
        resp = await client.get("/jobs/999999")
        body = await resp.json()

        assert resp.status == 404
        assert body == {
            "id": "not_found",
            "message": "Not found",
        }


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
        assert body["cancelled"] is False
        assert arrow.get(body["pinged_at"]) - arrow.utcnow() < datetime.timedelta(
            seconds=1,
        )

    async def test_not_found(self, spawn_job_client):
        """Test that a 404 is returned when the job doesn't exist."""
        client = await spawn_job_client(authenticated=True)

        resp = await client.put("/jobs/999999/ping", data={})

        assert resp.status == 404

    async def test_cancelled_true_when_cancelled(
        self,
        fake: DataFaker,
        spawn_job_client,
    ):
        """Test that cancelled is True when the job state is cancelled."""
        client = await spawn_job_client(authenticated=True)
        user = await fake.users.create()

        job = await fake.jobs.create(user, state=JobState.CANCELLED)

        resp = await client.put(f"/jobs/{job.id}/ping")
        body = await resp.json()

        assert resp.status == HTTPStatus.OK
        assert body["cancelled"] is True


@pytest.mark.parametrize(
    "error",
    [None, 404, "409_succeeded", "409_failed", "409_cancelled"],
)
async def test_cancel(
    error,
    fake: DataFaker,
    resp_is: RespIs,
    snapshot: SnapshotAssertion,
    spawn_client: ClientSpawner,
):
    client = await spawn_client(authenticated=True, permissions=[Permission.cancel_job])

    user = await fake.users.create()

    if error == 404:
        resp = await client.put("/jobs/999999/cancel", {})
        await resp_is.not_found(resp)
        return

    if error == "409_succeeded":
        job = await fake.jobs.create(user, state=JobState.SUCCEEDED)
    elif error == "409_failed":
        job = await fake.jobs.create(user, state=JobState.FAILED)
    elif error == "409_cancelled":
        job = await fake.jobs.create(user, state=JobState.CANCELLED)
    else:
        job = await fake.jobs.create(user, state=JobState.RUNNING)

    resp = await client.put(f"/jobs/{job.id}/cancel", {})

    if str(error).startswith("409"):
        await resp_is.conflict(resp, "Job cannot be cancelled in its current state")
        return

    assert resp.status == HTTPStatus.OK

    body = await resp.json()
    assert body == snapshot(matcher=_job_response_matcher)

    assert "key" not in body


async def test_status_route_removed(fake: DataFaker, spawn_client: ClientSpawner):
    client = await spawn_client(authenticated=True)

    user = await fake.users.create()
    job = await fake.jobs.create(user, state=JobState.RUNNING)

    resp = await client.post(
        f"/jobs/{job.id}/status",
        {"state": "failed", "progress": 100},
    )

    assert resp.status == HTTPStatus.NOT_FOUND


class TestClaim:
    """Tests for POST /jobs/claim endpoint."""

    async def test_ok(
        self,
        fake: DataFaker,
        pg: AsyncEngine,
        spawn_job_client: JobClientSpawner,
    ):
        """Test that a job can be claimed successfully."""
        client = await spawn_job_client(
            authenticated=False,
        )

        user = await fake.users.create()

        async with AsyncSession(pg) as session:
            job = SQLJob(
                created_at=arrow.utcnow().naive,
                state="pending",
                user_id=user.id,
                workflow="nuvs",
            )
            session.add(job)
            await session.flush()
            job_id = job.id
            await session.commit()

        resp = await client.post(
            "/jobs/claim?workflow=nuvs",
            json={
                "runner_id": "runner-1",
                "mem": 8.0,
                "cpu": 4.0,
                "image": "virtool/workflow:1.0.0",
                "runtime_version": "1.0.0",
                "workflow_version": "2.0.0",
                "steps": [
                    {"id": "step_1", "name": "Step 1", "description": "First step"},
                    {"id": "step_2", "name": "Step 2", "description": "Second step"},
                ],
            },
        )

        assert resp.status == HTTPStatus.OK

        body = await resp.json()

        assert body["id"] == job_id
        assert body["acquired"] is True
        assert body["state"] == "running"
        assert "key" in body
        assert body["claim"] == {
            "runner_id": "runner-1",
            "mem": 8.0,
            "cpu": 4.0,
            "image": "virtool/workflow:1.0.0",
            "runtime_version": "1.0.0",
            "workflow_version": "2.0.0",
        }
        assert body["steps"] == [
            {
                "id": "step_1",
                "name": "Step 1",
                "description": "First step",
                "started_at": None,
            },
            {
                "id": "step_2",
                "name": "Step 2",
                "description": "Second step",
                "started_at": None,
            },
        ]

    async def test_not_found(self, spawn_job_client: JobClientSpawner):
        """Test that 404 is returned when no pending job is available."""
        client = await spawn_job_client(
            authenticated=False,
        )

        resp = await client.post(
            "/jobs/claim?workflow=nuvs",
            json={
                "runner_id": "runner-1",
                "mem": 8.0,
                "cpu": 4.0,
                "image": "virtool/workflow:1.0.0",
                "runtime_version": "1.0.0",
                "workflow_version": "2.0.0",
                "steps": [],
            },
        )

        assert resp.status == HTTPStatus.NOT_FOUND

    async def test_claims_oldest_job(
        self,
        fake: DataFaker,
        pg: AsyncEngine,
        spawn_job_client: JobClientSpawner,
    ):
        """Test that the oldest pending job is claimed first."""
        client = await spawn_job_client(
            authenticated=False,
        )

        user = await fake.users.create()

        async with AsyncSession(pg) as session:
            older_job = SQLJob(
                created_at=arrow.utcnow().shift(hours=-1).naive,
                state="pending",
                user_id=user.id,
                workflow="nuvs",
            )
            newer_job = SQLJob(
                created_at=arrow.utcnow().naive,
                state="pending",
                user_id=user.id,
                workflow="nuvs",
            )
            session.add_all([older_job, newer_job])
            await session.flush()
            older_job_id = older_job.id
            await session.commit()

        resp = await client.post(
            "/jobs/claim?workflow=nuvs",
            json={
                "runner_id": "runner-1",
                "mem": 8.0,
                "cpu": 4.0,
                "image": "virtool/workflow:1.0.0",
                "runtime_version": "1.0.0",
                "workflow_version": "2.0.0",
                "steps": [],
            },
        )

        assert resp.status == HTTPStatus.OK
        body = await resp.json()
        assert body["id"] == older_job_id

    async def test_skips_already_claimed(
        self,
        fake: DataFaker,
        pg: AsyncEngine,
        spawn_job_client: JobClientSpawner,
    ):
        """Test that already-claimed jobs are skipped."""
        client = await spawn_job_client(
            authenticated=False,
        )

        user = await fake.users.create()

        async with AsyncSession(pg) as session:
            claimed_job = SQLJob(
                acquired=True,
                created_at=arrow.utcnow().shift(hours=-1).naive,
                state="running",
                user_id=user.id,
                workflow="nuvs",
            )
            pending_job = SQLJob(
                created_at=arrow.utcnow().naive,
                state="pending",
                user_id=user.id,
                workflow="nuvs",
            )
            session.add_all([claimed_job, pending_job])
            await session.flush()
            pending_job_id = pending_job.id
            await session.commit()

        resp = await client.post(
            "/jobs/claim?workflow=nuvs",
            json={
                "runner_id": "runner-1",
                "mem": 8.0,
                "cpu": 4.0,
                "image": "virtool/workflow:1.0.0",
                "runtime_version": "1.0.0",
                "workflow_version": "2.0.0",
                "steps": [],
            },
        )

        assert resp.status == HTTPStatus.OK
        body = await resp.json()
        assert body["id"] == pending_job_id

    async def test_feature_flag_disabled(
        self,
        spawn_job_client: JobClientSpawner,
    ):
        """Test that 404 is returned when feature flag is disabled."""
        client = await spawn_job_client(authenticated=False)

        resp = await client.post(
            "/jobs/claim?workflow=nuvs",
            json={
                "runner_id": "runner-1",
                "mem": 8.0,
                "cpu": 4.0,
                "image": "virtool/workflow:1.0.0",
                "runtime_version": "1.0.0",
                "workflow_version": "2.0.0",
                "steps": [],
            },
        )

        assert resp.status == HTTPStatus.NOT_FOUND


class TestFinish:
    """Tests for POST /jobs/{job_id}/finish endpoint."""

    async def test_ok(
        self,
        fake: DataFaker,
        pg: AsyncEngine,
        spawn_job_client: JobClientSpawner,
    ):
        """Test that a running job can be finished."""
        client = await spawn_job_client(authenticated=False)

        user = await fake.users.create()
        job = await fake.jobs.create(user, state=JobState.RUNNING)

        resp = await client.post(f"/jobs/{job.id}/finish")

        assert resp.status == HTTPStatus.OK

        body = await resp.json()
        assert body["state"] == "succeeded"
        assert "key" not in body

        async with AsyncSession(pg) as session:
            sql_job = (
                await session.execute(select(SQLJob).where(SQLJob.id == job.id))
            ).scalar()

        assert sql_job.state == "succeeded"
        assert sql_job.finished_at is not None

    async def test_not_found(self, spawn_job_client: JobClientSpawner):
        """Test that 404 is returned when the job doesn't exist."""
        client = await spawn_job_client(authenticated=False)

        resp = await client.post("/jobs/999999/finish")

        assert resp.status == HTTPStatus.NOT_FOUND

    @pytest.mark.parametrize(
        "state",
        [JobState.PENDING, JobState.SUCCEEDED, JobState.FAILED, JobState.CANCELLED],
    )
    async def test_not_running(
        self,
        state: JobState,
        fake: DataFaker,
        spawn_job_client: JobClientSpawner,
    ):
        """Test that 409 is returned when the job isn't running."""
        client = await spawn_job_client(authenticated=False)

        user = await fake.users.create()
        job = await fake.jobs.create(user, state=state)

        resp = await client.post(f"/jobs/{job.id}/finish")

        assert resp.status == HTTPStatus.CONFLICT


class TestStartStep:
    """Tests for POST /jobs/{job_id}/steps/{step_id}/start endpoint."""

    async def test_ok(
        self,
        fake: DataFaker,
        pg: AsyncEngine,
        spawn_job_client: JobClientSpawner,
    ):
        """Test that a step can be started successfully."""
        client = await spawn_job_client(
            authenticated=False,
        )

        user = await fake.users.create()

        async with AsyncSession(pg) as session:
            job = SQLJob(
                acquired=True,
                created_at=arrow.utcnow().naive,
                state="running",
                user_id=user.id,
                workflow="nuvs",
                steps=[
                    {"id": "step_1", "name": "Step 1", "description": "First step"},
                    {"id": "step_2", "name": "Step 2", "description": "Second step"},
                ],
            )
            session.add(job)
            await session.flush()
            job_id = job.id
            await session.commit()

        resp = await client.post(f"/jobs/{job_id}/steps/step_1/start")

        assert resp.status == HTTPStatus.OK

        body = await resp.json()

        assert body["id"] == "step_1"
        assert body["name"] == "Step 1"
        assert body["description"] == "First step"
        assert "started_at" in body

        async with AsyncSession(pg) as session:
            sql_job = (
                await session.execute(select(SQLJob).where(SQLJob.id == job_id))
            ).scalar()

        assert sql_job.steps[0]["started_at"] is not None

    async def test_not_found(self, spawn_job_client: JobClientSpawner):
        """Test that 404 is returned when job doesn't exist."""
        client = await spawn_job_client(
            authenticated=False,
        )

        resp = await client.post("/jobs/99999/steps/step_1/start")

        assert resp.status == HTTPStatus.NOT_FOUND

    async def test_step_not_found(
        self,
        fake: DataFaker,
        pg: AsyncEngine,
        spawn_job_client: JobClientSpawner,
    ):
        """Test that 404 is returned when step doesn't exist."""
        client = await spawn_job_client(
            authenticated=False,
        )

        user = await fake.users.create()

        async with AsyncSession(pg) as session:
            job = SQLJob(
                acquired=True,
                created_at=arrow.utcnow().naive,
                state="running",
                user_id=user.id,
                workflow="nuvs",
                steps=[
                    {"id": "step_1", "name": "Step 1", "description": "First step"},
                ],
            )
            session.add(job)
            await session.flush()
            job_id = job.id
            await session.commit()

        resp = await client.post(f"/jobs/{job_id}/steps/nonexistent/start")

        assert resp.status == HTTPStatus.NOT_FOUND

    async def test_already_started(
        self,
        fake: DataFaker,
        pg: AsyncEngine,
        spawn_job_client: JobClientSpawner,
    ):
        """Test that 409 is returned when step is already started."""
        client = await spawn_job_client(
            authenticated=False,
        )

        user = await fake.users.create()

        async with AsyncSession(pg) as session:
            job = SQLJob(
                acquired=True,
                created_at=arrow.utcnow().naive,
                state="running",
                user_id=user.id,
                workflow="nuvs",
                steps=[
                    {
                        "id": "step_1",
                        "name": "Step 1",
                        "description": "First step",
                        "started_at": arrow.utcnow().naive.isoformat(),
                    },
                ],
            )
            session.add(job)
            await session.flush()
            job_id = job.id
            await session.commit()

        resp = await client.post(f"/jobs/{job_id}/steps/step_1/start")

        assert resp.status == HTTPStatus.CONFLICT
        assert await resp.json() == {
            "id": "conflict",
            "message": "Step already started",
        }

    @pytest.mark.parametrize("state", ["cancelled", "failed", "succeeded"])
    async def test_terminal_state(
        self,
        state: str,
        fake: DataFaker,
        pg: AsyncEngine,
        spawn_job_client: JobClientSpawner,
    ):
        """Test that 409 is returned when job is in a terminal state."""
        client = await spawn_job_client(
            authenticated=False,
        )

        user = await fake.users.create()

        async with AsyncSession(pg) as session:
            job = SQLJob(
                acquired=True,
                created_at=arrow.utcnow().naive,
                state=state,
                user_id=user.id,
                workflow="nuvs",
                steps=[
                    {"id": "step_1", "name": "Step 1", "description": "First step"},
                ],
            )
            session.add(job)
            await session.flush()
            job_id = job.id
            await session.commit()

        resp = await client.post(f"/jobs/{job_id}/steps/step_1/start")

        assert resp.status == HTTPStatus.CONFLICT

    async def test_feature_flag_disabled(
        self,
        spawn_job_client: JobClientSpawner,
    ):
        """Test that 404 is returned when feature flag is disabled."""
        client = await spawn_job_client(authenticated=False)

        resp = await client.post("/jobs/1/steps/step_1/start")

        assert resp.status == HTTPStatus.NOT_FOUND
