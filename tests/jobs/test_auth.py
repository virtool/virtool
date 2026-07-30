from http import HTTPStatus

import pytest
from aiohttp import BasicAuth
from aiohttp.web_request import Request
from aiohttp.web_response import Response
from aiohttp.web_routedef import RouteTableDef
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.jobs.models import JobState
from virtool.jobs.pg import SQLJob

test_routes = RouteTableDef()

CLAIM_BODY = {
    "runner_id": "runner-1",
    "mem": 8.0,
    "cpu": 4.0,
    "image": "virtool/workflow:1.0.0",
    "runtime_version": "1.0.0",
    "workflow_version": "2.0.0",
    "steps": [],
}


async def claim_job(client, job) -> str:
    response = await client.post(
        f"/jobs/claim?workflow={job.workflow.value}",
        json=CLAIM_BODY,
    )
    body = await response.json()

    assert response.status == HTTPStatus.OK
    assert "key" in body

    return body["key"]


@test_routes.get("/not_public")
def non_public_test_route(request: Request):
    return Response(status=200)


class TestPolicyResolution:
    """Test that policies resolve for both shapes of handler the jobs API serves.

    Policies are declared on plain request handler functions (``virtool/api/root.py``)
    and on methods of ``PydanticView`` subclasses (``virtool/jobs/api.py``). If
    resolution regresses for either shape, protected routes silently become public or
    live workflows start getting rejected.
    """

    async def test_public_function_handler(self, spawn_job_client):
        """A public plain function handler is reachable without a job key."""
        client = await spawn_job_client(authenticated=False)

        response = await client.get("/")

        assert response.status == HTTPStatus.OK

    async def test_non_public_function_handler(self, spawn_job_client):
        """A plain function handler without a policy requires a job key."""
        client = await spawn_job_client(
            authenticated=False,
            add_route_table=test_routes,
        )

        response = await client.get("/not_public")

        assert response.status == HTTPStatus.UNAUTHORIZED

    async def test_public_view_method(self, fake, spawn_job_client):
        """A public ``PydanticView`` method is reachable without a job key."""
        client = await spawn_job_client(authenticated=False)

        user = await fake.users.create()
        await fake.jobs.create(user=user, state=JobState.PENDING, workflow="nuvs")

        response = await client.post("/jobs/claim?workflow=nuvs", json=CLAIM_BODY)

        assert response.status == HTTPStatus.OK

    async def test_non_public_view_method(self, fake, spawn_job_client):
        """A ``PydanticView`` method without a policy requires a job key."""
        client = await spawn_job_client(authenticated=False)

        job = await fake.jobs.create(user=await fake.users.create())

        response = await client.get(f"/jobs/{job.id}")

        assert response.status == HTTPStatus.UNAUTHORIZED

    async def test_non_public_view_method_when_authenticated(
        self,
        fake,
        spawn_job_client,
    ):
        """A ``PydanticView`` method without a policy is reachable with a job key."""
        client = await spawn_job_client(authenticated=True)

        job = await fake.jobs.create(user=await fake.users.create())

        response = await client.get(f"/jobs/{job.id}")

        assert response.status == HTTPStatus.OK


async def test_unauthorized_when_header_invalid(spawn_job_client):
    client = await spawn_job_client(authenticated=False, add_route_table=test_routes)

    response = await client.get(
        "/not_public",
        headers={
            "Authorization": "Basic job-not_a_job_id:not_a_key",
        },
    )

    assert response.status == 401


async def test_authorized_when_header_is_valid(fake, spawn_job_client):
    """Test that a job can authenticate after claiming with the returned key."""
    user = await fake.users.create()
    job = await fake.jobs.create(user=user, state=JobState.PENDING, workflow="nuvs")

    client = await spawn_job_client(
        authenticated=False,
        add_route_table=test_routes,
    )

    key = await claim_job(client, job)

    auth = BasicAuth(login=f"job-{job.id}", password=key)
    response = await client.get(
        "/not_public",
        headers={"Authorization": auth.encode()},
    )

    assert response.status == HTTPStatus.OK


async def test_unauthorized_with_wrong_job_id(fake, spawn_job_client):
    """Test that a job cannot authenticate using another job's ID."""
    user = await fake.users.create()

    job_1 = await fake.jobs.create(user=user, state=JobState.PENDING, workflow="nuvs")
    job_2 = await fake.jobs.create(user=user, state=JobState.PENDING, workflow="nuvs")

    client = await spawn_job_client(
        authenticated=False,
        add_route_table=test_routes,
    )

    key_1 = await claim_job(client, job_1)

    auth = BasicAuth(login=f"job-{job_2.id}", password=key_1)
    response = await client.get(
        "/not_public",
        headers={"Authorization": auth.encode()},
    )

    assert response.status == 401


async def test_unauthorized_with_wrong_key(fake, spawn_job_client):
    """Test that a job cannot authenticate with an incorrect key."""
    user = await fake.users.create()
    job = await fake.jobs.create(user=user, state=JobState.PENDING, workflow="nuvs")

    client = await spawn_job_client(
        authenticated=False,
        add_route_table=test_routes,
    )
    await claim_job(client, job)

    auth = BasicAuth(login=f"job-{job.id}", password="wrong_key")
    response = await client.get(
        "/not_public",
        headers={"Authorization": auth.encode()},
    )

    assert response.status == 401


async def test_unauthorized_with_nonexistent_job(spawn_job_client):
    """Test that authentication fails when job doesn't exist in database."""
    client = await spawn_job_client(authenticated=False, add_route_table=test_routes)

    auth = BasicAuth(login="job-nonexistent_job_id", password="some_key")
    response = await client.get(
        "/not_public",
        headers={"Authorization": auth.encode()},
    )

    assert response.status == 401


@pytest.mark.parametrize(
    "state",
    [
        JobState.SUCCEEDED,
        JobState.FAILED,
        JobState.CANCELLED,
    ],
)
async def test_unauthorized_when_job_in_terminal_state(
    state: JobState,
    fake,
    pg: AsyncEngine,
    spawn_job_client,
):
    """Test that jobs in terminal states cannot authenticate even with valid credentials."""
    user = await fake.users.create()
    job = await fake.jobs.create(user=user, state=JobState.PENDING, workflow="nuvs")

    client = await spawn_job_client(
        authenticated=False,
        add_route_table=test_routes,
    )

    key = await claim_job(client, job)

    async with AsyncSession(pg) as session:
        sql_job = (
            await session.execute(select(SQLJob).where(SQLJob.id == job.id))
        ).scalar()
        sql_job.state = state.value
        await session.commit()

    auth = BasicAuth(login=f"job-{job.id}", password=key)
    response = await client.get(
        "/not_public",
        headers={"Authorization": auth.encode()},
    )

    assert response.status == 401
