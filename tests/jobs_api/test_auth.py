import aiohttp.web

test_routes = aiohttp.web.RouteTableDef()


@test_routes.patch("/api/jobs/{job_id}")
def public_test_route(request: aiohttp.web.Request):
    return aiohttp.web.Response(status=200)


@test_routes.get("/api/not_public")
def non_public_test_route(request: aiohttp.web.Request):
    return aiohttp.web.Response(status=200)


async def test_public_routes_are_public(spawn_job_client):
    client = await spawn_job_client(authorize=False, add_route_table=test_routes)

    job_id = "test_job"
    insert_result = await client.db.jobs.insert_one({"_id": job_id})

    assert insert_result["_id"] == job_id

    response = await client.patch(f"/api/jobs/{job_id}")

    assert response.status == 200


async def test_unauthorized_when_header_missing(spawn_job_client):
    client = await spawn_job_client(authorize=False, add_route_table=test_routes)

    response = await client.get("/api/not_public")

    assert response.status == 401


async def test_unauthorized_when_header_invalid(spawn_job_client):
    client = await spawn_job_client(authorize=False, add_route_table=test_routes)

    response = await client.get("/api/not_public", headers={
        "Authorization": "Basic job-not_a_job_id:not_a_key",
        "content-type": "application/json",
    })

    print(response)
    raise
    assert response.status == 401


async def test_authorized_when_header_is_valid():
    assert False
