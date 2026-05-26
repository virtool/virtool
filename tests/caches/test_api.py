from collections.abc import AsyncIterator
from http import HTTPStatus

import pytest
from aiohttp import BasicAuth

from tests.fixtures.response import RespIs
from virtool.api.custom_json import dump_string
from virtool.data.layer import DataLayer
from virtool.storage.protocol import StorageBackend


async def _chunker(payload: bytes) -> AsyncIterator[bytes]:
    yield payload


async def _chunked_body(payload: bytes) -> AsyncIterator[bytes]:
    yield payload


async def test_get(data_layer: DataLayer, spawn_job_client):
    key = "trim-reads-get"
    params = {"workflow": "create_sample", "step": "trim_reads"}
    payload = b"trimmed reads"

    await data_layer.caches.create(_chunker(payload), key, params)

    client = await spawn_job_client(authenticated=True)

    resp = await client.get(f"/caches/{key}")

    assert resp.status == HTTPStatus.OK
    assert resp.headers["Content-Type"] == "application/octet-stream"
    assert resp.headers["Content-Length"] == str(len(payload))
    assert await resp.read() == payload


async def test_get_not_found(spawn_job_client):
    client = await spawn_job_client(authenticated=True)

    resp = await client.get("/caches/missing-cache")

    await RespIs.not_found(resp)


async def test_get_storage_not_found(
    data_layer: DataLayer,
    memory_storage: StorageBackend,
    spawn_job_client,
):
    key = "trim-reads-missing-storage"

    await data_layer.caches.create(_chunker(b"orphaned"), key, {"step": "trim_reads"})

    async for info in memory_storage.list("caches/v1/"):
        await memory_storage.delete(info.key)

    client = await spawn_job_client(authenticated=True)

    resp = await client.get(f"/caches/{key}")

    await RespIs.not_found(resp)


async def test_put_create_then_get(spawn_job_client):
    key = "trim-reads-put"
    params = {"workflow": "create_sample", "step": "trim_reads", "min_length": 50}
    payload = b"fresh cached payload"

    client = await spawn_job_client(authenticated=True)

    put_resp = await client.put(
        f"/caches/{key}",
        data=payload,
        params={"params": dump_string(params)},
    )

    assert put_resp.status == HTTPStatus.CREATED
    assert await put_resp.read() == b""

    get_resp = await client.get(f"/caches/{key}")

    assert get_resp.status == HTTPStatus.OK
    assert get_resp.headers["Content-Length"] == str(len(payload))
    assert await get_resp.read() == payload


async def test_put_duplicate_returns_ok_and_keeps_original_blob(
    spawn_job_client,
):
    key = "trim-reads-put-duplicate"
    params = {"workflow": "create_sample", "step": "trim_reads"}
    first_payload = b"first payload"
    second_payload = b"second payload"

    client = await spawn_job_client(authenticated=True)

    first_resp = await client.put(
        f"/caches/{key}",
        data=first_payload,
        params={"params": dump_string(params)},
    )

    second_resp = await client.put(
        f"/caches/{key}",
        data=second_payload,
        params={"params": dump_string(params)},
    )

    assert first_resp.status == HTTPStatus.CREATED
    assert await first_resp.read() == b""
    assert second_resp.status == HTTPStatus.OK
    assert await second_resp.read() == b""

    blob_resp = await client.get(f"/caches/{key}")

    assert blob_resp.status == HTTPStatus.OK
    assert await blob_resp.read() == first_payload


@pytest.mark.parametrize(
    ("params", "message"),
    [
        ("{", "Invalid JSON in 'params' query parameter"),
        ("[]", "Query parameter 'params' must be a JSON object"),
    ],
)
async def test_put_bad_params(params: str, message: str, spawn_job_client):
    client = await spawn_job_client(authenticated=True)

    resp = await client.put(
        "/caches/bad-params",
        data=b"cached-bytes",
        params={"params": params},
    )

    await RespIs.bad_request(resp, message)


async def test_put_defaults_params_to_empty_dict(spawn_job_client):
    key = "trim-reads-no-params"
    payload = b"cached"

    client = await spawn_job_client(authenticated=True)

    resp = await client.put(f"/caches/{key}", data=payload)

    assert resp.status == HTTPStatus.CREATED
    assert await resp.read() == b""


async def test_put_accepts_null_params(spawn_job_client):
    key = "trim-reads-null-params"
    payload = b"cached"

    client = await spawn_job_client(authenticated=True)

    resp = await client.put(
        f"/caches/{key}",
        data=payload,
        params={"params": "null"},
    )

    assert resp.status == HTTPStatus.CREATED
    assert await resp.read() == b""


async def test_put_requires_content_length(spawn_job_client):
    client = await spawn_job_client(authenticated=True)

    resp = await client.put("/caches/chunked-body", data=_chunked_body(b"cached"))

    await RespIs.bad_request(resp, "Content-Length header is required")


async def test_delete_not_registered(spawn_job_client):
    client = await spawn_job_client(authenticated=True)

    resp = await client.delete("/caches/cache-key")

    assert resp.status == HTTPStatus.METHOD_NOT_ALLOWED


async def test_blob_route_not_registered(spawn_job_client):
    client = await spawn_job_client(authenticated=True)

    resp = await client.get("/caches/cache-key/blob")

    assert resp.status == HTTPStatus.NOT_FOUND


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("get", "/caches/cache-key"),
        ("put", "/caches/cache-key"),
    ],
)
async def test_auth_required(method: str, path: str, spawn_job_client):
    client = await spawn_job_client(authenticated=False)

    if method == "put":
        resp = await client.put(path, data=b"")
    else:
        resp = await client.get(path)

    assert resp.status == HTTPStatus.UNAUTHORIZED


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("get", "/caches/cache-key"),
        ("put", "/caches/cache-key"),
    ],
)
async def test_auth_invalid(method: str, path: str, spawn_job_client):
    client = await spawn_job_client(authenticated=False)
    headers = {"Authorization": BasicAuth("job-999999", "wrong-key").encode()}

    if method == "put":
        resp = await client.put(path, data=b"", headers=headers)
    else:
        resp = await client.get(path, headers=headers)

    assert resp.status == HTTPStatus.UNAUTHORIZED
