from collections.abc import AsyncIterator
from http import HTTPStatus

import pytest
from aiohttp import BasicAuth, FormData

from tests.fixtures.response import RespIs
from virtool.api.custom_json import dump_string
from virtool.data.layer import DataLayer
from virtool.storage.protocol import StorageBackend


async def _chunker(payload: bytes) -> AsyncIterator[bytes]:
    yield payload


def _form(params, payload: bytes = b"cached-bytes") -> FormData:
    form = FormData()
    form.add_field("params", dump_string(params), content_type="application/json")
    form.add_field(
        "blob",
        payload,
        content_type="application/octet-stream",
        filename="cache.bin",
    )
    return form


def _malformed_form(params: str, payload: bytes = b"cached-bytes") -> FormData:
    form = FormData()
    form.add_field("params", params, content_type="application/json")
    form.add_field(
        "blob",
        payload,
        content_type="application/octet-stream",
        filename="cache.bin",
    )
    return form


def _assert_metadata(body: dict, key: str, params: dict, size: int):
    assert body["key"] == key
    assert body["params"] == params
    assert body["size"] == size
    assert isinstance(body["id"], int)
    assert isinstance(body["created_at"], str)
    assert isinstance(body["last_accessed_at"], str)
    assert "data" not in body
    assert "storage_key" not in body


async def test_get(data_layer: DataLayer, spawn_job_client):
    key = "trim-reads-get"
    params = {"workflow": "create_sample", "step": "trim_reads"}
    payload = b"trimmed reads"

    await data_layer.caches.create(_chunker(payload), key, params)

    client = await spawn_job_client(authenticated=True)

    resp = await client.get(f"/caches/{key}")
    body = await resp.json()

    assert resp.status == HTTPStatus.OK
    _assert_metadata(body, key, params, len(payload))


async def test_get_not_found(spawn_job_client):
    client = await spawn_job_client(authenticated=True)

    resp = await client.get("/caches/missing-cache")

    await RespIs.not_found(resp)


async def test_get_blob(data_layer: DataLayer, spawn_job_client):
    key = "trim-reads-blob"
    payload = b"trimmed reads blob"

    await data_layer.caches.create(_chunker(payload), key, {"step": "trim_reads"})

    client = await spawn_job_client(authenticated=True)

    resp = await client.get(f"/caches/{key}/blob")

    assert resp.status == HTTPStatus.OK
    assert resp.headers["Content-Type"] == "application/octet-stream"
    assert resp.headers["Content-Length"] == str(len(payload))
    assert await resp.read() == payload


async def test_get_blob_not_found(spawn_job_client):
    client = await spawn_job_client(authenticated=True)

    resp = await client.get("/caches/missing-cache/blob")

    await RespIs.not_found(resp)


async def test_get_blob_storage_not_found(
    data_layer: DataLayer,
    memory_storage: StorageBackend,
    spawn_job_client,
):
    key = "trim-reads-missing-storage"

    await data_layer.caches.create(_chunker(b"orphaned"), key, {"step": "trim_reads"})

    async for info in memory_storage.list("caches/v1/"):
        await memory_storage.delete(info.key)

    client = await spawn_job_client(authenticated=True)

    resp = await client.get(f"/caches/{key}/blob")

    await RespIs.not_found(resp)


async def test_put_create_then_get(spawn_job_client):
    key = "trim-reads-put"
    params = {"workflow": "create_sample", "step": "trim_reads", "min_length": 50}
    payload = b"fresh cached payload"

    client = await spawn_job_client(authenticated=True)

    put_resp = await client.put(f"/caches/{key}", data=_form(params, payload))
    put_body = await put_resp.json()

    assert put_resp.status == HTTPStatus.CREATED
    _assert_metadata(put_body, key, params, len(payload))

    get_resp = await client.get(f"/caches/{key}")
    get_body = await get_resp.json()

    assert get_resp.status == HTTPStatus.OK
    assert get_body == put_body


async def test_put_duplicate_returns_existing_metadata_and_keeps_original_blob(
    spawn_job_client,
):
    key = "trim-reads-put-duplicate"
    params = {"workflow": "create_sample", "step": "trim_reads"}
    first_payload = b"first payload"
    second_payload = b"second payload"

    client = await spawn_job_client(authenticated=True)

    first_resp = await client.put(f"/caches/{key}", data=_form(params, first_payload))
    first_body = await first_resp.json()

    second_resp = await client.put(f"/caches/{key}", data=_form(params, second_payload))
    second_body = await second_resp.json()

    assert first_resp.status == HTTPStatus.CREATED
    assert second_resp.status == HTTPStatus.OK
    assert second_body == first_body

    blob_resp = await client.get(f"/caches/{key}/blob")

    assert blob_resp.status == HTTPStatus.OK
    assert await blob_resp.read() == first_payload


@pytest.mark.parametrize("params", ["{", "[]"])
async def test_put_bad_params(params: str, spawn_job_client):
    client = await spawn_job_client(authenticated=True)

    resp = await client.put("/caches/bad-params", data=_malformed_form(params))

    await RespIs.bad_request(resp)


async def test_put_missing_blob(spawn_job_client):
    form = FormData()
    form.add_field(
        "params",
        dump_string({"step": "trim_reads"}),
        content_type="application/json",
    )

    client = await spawn_job_client(authenticated=True)

    resp = await client.put("/caches/missing-blob", data=form)

    await RespIs.bad_request(resp)


async def test_put_rejects_legacy_top_level_fields(spawn_job_client):
    form = FormData()
    form.add_field("cache_type", "reads")
    form.add_field("params", dump_string({"step": "trim_reads"}))
    form.add_field(
        "blob",
        b"cached",
        content_type="application/octet-stream",
        filename="cache.bin",
    )

    client = await spawn_job_client(authenticated=True)

    resp = await client.put("/caches/legacy-fields", data=form)

    await RespIs.bad_request(resp)


async def test_put_rejects_legacy_top_level_fields_after_blob(spawn_job_client):
    form = _form({"step": "trim_reads"})
    form.add_field("parent_id", "sample-id")

    client = await spawn_job_client(authenticated=True)

    resp = await client.put("/caches/legacy-fields-after-blob", data=form)

    await RespIs.bad_request(resp)


async def test_delete_not_registered(spawn_job_client):
    client = await spawn_job_client(authenticated=True)

    resp = await client.delete("/caches/cache-key")

    assert resp.status == HTTPStatus.METHOD_NOT_ALLOWED


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("get", "/caches/cache-key"),
        ("get", "/caches/cache-key/blob"),
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
        ("get", "/caches/cache-key/blob"),
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
