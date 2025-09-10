from http import HTTPStatus

import pytest
from aiohttp import BasicAuth
from aiohttp.web_request import Request
from aiohttp.web_response import Response
from aiohttp.web_routedef import RouteTableDef

from virtool.jobs.models import JobState

test_routes = RouteTableDef()


@test_routes.patch("/test_jobs/{job_id}")
def public_test_route(request: Request):
    return Response(status=200)


@test_routes.get("/not_public")
def non_public_test_route(request: Request):
    return Response(status=200)


async def test_public_routes_are_public(fake, spawn_job_client):
    """Test that the acquire endpoint is public and doesn't require authentication."""
    client = await spawn_job_client(authenticated=False)

    user = await fake.users.create()
    job = await fake.jobs.create(user=user, state=JobState.WAITING)

    # Should be able to acquire without authentication
    response = await client.patch(f"/jobs/{job.id}", json={"acquired": True})

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
    """Test that a job can authenticate after acquiring with the returned key."""
    user = await fake.users.create()
    job = await fake.jobs.create(user=user, state=JobState.WAITING)

    # Use single client with test routes
    client = await spawn_job_client(authenticated=False, add_route_table=test_routes)

    # Acquire the job to get the key (hits real acquire endpoint, not test_routes)
    acquire_response = await client.patch(
        f"/jobs/{job.id}",
        json={"acquired": True},
    )
    acquire_body = await acquire_response.json()

    assert acquire_response.status == HTTPStatus.OK
    assert "key" in acquire_body

    key = acquire_body["key"]

    # Test authentication with the key
    auth = BasicAuth(login=f"job-{job.id}", password=key)
    response = await client.get(
        "/not_public",
        headers={"Authorization": auth.encode()},
    )

    assert response.status == HTTPStatus.OK


async def test_unauthorized_with_wrong_job_id(fake, spawn_job_client):
    """Test that a job cannot authenticate using another job's ID."""
    user = await fake.users.create()

    job_1 = await fake.jobs.create(user=user, state=JobState.WAITING)
    job_2 = await fake.jobs.create(user=user, state=JobState.WAITING)

    client = await spawn_job_client(authenticated=False, add_route_table=test_routes)

    # Acquire job_1 and get its key
    acquire_response = await client.patch(
        f"/jobs/{job_1.id}",
        json={"acquired": True},
    )
    acquire_body = await acquire_response.json()

    assert acquire_response.status == HTTPStatus.OK
    key_1 = acquire_body["key"]

    # Try to authenticate using job_2's ID with job_1's key
    auth = BasicAuth(login=f"job-{job_2.id}", password=key_1)
    response = await client.get(
        "/not_public",
        headers={"Authorization": auth.encode()},
    )

    assert response.status == 401


async def test_unauthorized_with_wrong_key(fake, spawn_job_client):
    """Test that a job cannot authenticate with an incorrect key."""
    user = await fake.users.create()
    job = await fake.jobs.create(user=user, state=JobState.WAITING)

    client = await spawn_job_client(authenticated=False, add_route_table=test_routes)

    # Acquire the job successfully
    acquire_response = await client.patch(
        f"/jobs/{job.id}",
        json={"acquired": True},
    )
    assert acquire_response.status == HTTPStatus.OK

    # Try to authenticate with correct job ID but wrong key
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
        JobState.COMPLETE,
        JobState.ERROR,
        JobState.CANCELLED,
        JobState.TERMINATED,
        JobState.TIMEOUT,
    ],
)
async def test_unauthorized_when_job_in_terminal_state(
    state: JobState,
    data_layer,
    fake,
    spawn_job_client,
):
    """Test that jobs in terminal states cannot authenticate even with valid credentials."""
    user = await fake.users.create()
    job = await fake.jobs.create(user=user, state=JobState.WAITING)

    client = await spawn_job_client(authenticated=False, add_route_table=test_routes)

    # Acquire the job and get valid credentials
    acquire_response = await client.patch(
        f"/jobs/{job.id}",
        json={"acquired": True},
    )
    acquire_body = await acquire_response.json()

    assert acquire_response.status == HTTPStatus.OK
    key = acquire_body["key"]

    # Push terminal status to job
    await data_layer.jobs.push_status(
        job.id,
        state,
        stage=None,
        progress=100,
    )

    # Try to authenticate with valid credentials but terminal state job
    auth = BasicAuth(login=f"job-{job.id}", password=key)
    response = await client.get(
        "/not_public",
        headers={"Authorization": auth.encode()},
    )

    assert response.status == 401
