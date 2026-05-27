from collections.abc import AsyncIterator
from http import HTTPStatus

import pytest

from tests.fixtures.response import RespIs
from virtool.api.custom_json import dump_string
from virtool.data.layer import DataLayer
from virtool.storage.protocol import StorageBackend


async def _chunker(payload: bytes) -> AsyncIterator[bytes]:
    yield payload


async def _chunked_body(payload: bytes) -> AsyncIterator[bytes]:
    yield payload


async def test_get(spawn_job_client):
    key = "trim-reads-get"
    params = {"workflow": "create_sample", "step": "trim_reads", "min_length": 50}
    payload = b"trimmed reads"

    client = await spawn_job_client(authenticated=True)

    put_resp = await client.put(
        f"/caches/{key}",
        data=payload,
        params={"params": dump_string(params)},
    )

    assert put_resp.status == HTTPStatus.CREATED
    assert await put_resp.read() == b""

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


@pytest.mark.parametrize(
    ("key", "params"),
    [
        ("trim-reads-no-params", None),
        ("trim-reads-null-params", {"params": "null"}),
    ],
)
async def test_put_defaults_empty_or_null_params_to_empty_dict(
    key,
    params,
    spawn_job_client,
):
    payload = b"cached"

    client = await spawn_job_client(authenticated=True)

    resp = await client.put(
        f"/caches/{key}",
        data=payload,
        params=params,
    )

    assert resp.status == HTTPStatus.CREATED
    assert await resp.read() == b""

    get_resp = await client.get(f"/caches/{key}")

    assert get_resp.status == HTTPStatus.OK
    assert get_resp.headers["Content-Length"] == str(len(payload))
    assert await get_resp.read() == payload


async def test_put_requires_content_length(spawn_job_client):
    client = await spawn_job_client(authenticated=True)

    resp = await client.put("/caches/chunked-body", data=_chunked_body(b"cached"))

    await RespIs.bad_request(resp, "Content-Length header is required")
