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


async def test_public_routes_are_public(fake, spawn_job_client):
    """Test that the claim endpoint is public and doesn't require authentication."""
    client = await spawn_job_client(
        authenticated=False,
    )

    user = await fake.users.create()
    await fake.jobs.create(user=user, state=JobState.PENDING, workflow="nuvs")

    response = await client.post("/jobs/claim?workflow=nuvs", json=CLAIM_BODY)

    assert response.status == HTTPStatus.OK


async def test_unauthorized_when_header_missing(spawn_job_client):
    client = await spawn_job_client(authenticated=False, add_route_table=test_routes)

    response = await client.get("/not_public")

    assert response.status == 401


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
