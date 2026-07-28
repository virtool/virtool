import datetime
from http import HTTPStatus
from types import NoneType

import arrow
import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from syrupy import SnapshotAssertion
from syrupy.matchers import path_type

from tests.fixtures.client import JobClientSpawner
from virtool.fake.next import DataFaker
from virtool.jobs.models import JobState
from virtool.jobs.pg import SQLJob

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


class TestGetCounts:
    async def test_ok(self, fake: DataFaker, spawn_job_client: JobClientSpawner):
        client = await spawn_job_client(authenticated=False)

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

    async def test_empty(self, spawn_job_client: JobClientSpawner):
        client = await spawn_job_client(authenticated=False)

        resp = await client.get("/jobs/counts")

        assert resp.status == HTTPStatus.OK

        body = await resp.json()

        assert sum(c for counts in body.values() for c in counts.values()) == 0


class TestGet:
    async def test_ok(
        self,
        fake: DataFaker,
        snapshot: SnapshotAssertion,
        spawn_job_client: JobClientSpawner,
    ):
        client = await spawn_job_client(authenticated=True)

        job = await fake.jobs.create(user=await fake.users.create())

        resp = await client.get(f"/jobs/{job.id}")
        body = await resp.json()

        assert resp.status == HTTPStatus.OK
        assert body == snapshot(matcher=_job_response_matcher)

        # Explicitly ensure the secret API key is not returned in the response.
        assert "key" not in body

    async def test_not_found(self, spawn_job_client: JobClientSpawner):
        client = await spawn_job_client(authenticated=True)

        resp = await client.get("/jobs/999999")

        assert resp.status == HTTPStatus.NOT_FOUND
        assert await resp.json() == {
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
