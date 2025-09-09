from http import HTTPStatus

from aiohttp.web_request import Request
from aiohttp.web_response import Response
from aiohttp.web_routedef import RouteTableDef

from virtool.mongo.core import Mongo

test_routes = RouteTableDef()


@test_routes.patch("/jobs/{job_id}")
def public_test_route(request: Request):
    return Response(status=200)


@test_routes.get("/not_public")
def non_public_test_route(request: Request):
    return Response(status=200)


async def test_public_routes_are_public(mongo: Mongo, spawn_job_client):
    client = await spawn_job_client(authenticated=False, add_route_table=test_routes)

    job_id = "test_job"
    insert_result = await mongo.jobs.insert_one({"_id": job_id})

    assert insert_result["_id"] == job_id

    response = await client.patch(f"/jobs/{job_id}")

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


async def test_authorized_when_header_is_valid(spawn_job_client):
    client = await spawn_job_client(authenticated=True, add_route_table=test_routes)

    response = await client.get("/not_public")

    assert response.status == HTTPStatus.OK
