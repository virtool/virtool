"""Fixtures for the Garage (S3) and Azurite (Azure Blob) integration test services.

Connection parameters are read from the ``VT_TEST_*`` environment variables set by
``docker-compose.yml`` on the ``test`` service. Each test receives a fresh
``ObstoreProvider`` whose per-test prefix has been purged, so multiple xdist
workers can share the same bucket and container.
"""

import base64
import hashlib
import hmac
import os
from collections.abc import AsyncIterator
from email.utils import formatdate

import aiohttp
import pytest
from obstore.store import AzureStore, S3Store

from virtool.storage.memory import MemoryStorageProvider
from virtool.storage.obstore import ObstoreProvider
from virtool.storage.protocol import StorageBackend


async def _ensure_azurite_container(
    account: str, key: str, endpoint: str, container: str
) -> None:
    """Create the Azurite container if it does not already exist.

    Azurite requires containers to be provisioned out-of-band. This helper signs a
    `PUT /{container}?restype=container` request with the account shared key and
    accepts 201 (created) or 409 (already exists) as success.
    """
    url = f"{endpoint}/{container}?restype=container"
    account_path = endpoint.removeprefix("http://").split("/", 1)[1]

    date = formatdate(timeval=None, localtime=False, usegmt=True)
    canonical_headers = f"x-ms-date:{date}\nx-ms-version:2023-11-03\n"
    canonical_resource = f"/{account}/{account_path}/{container}\nrestype:container"

    string_to_sign = (
        "\n".join(
            ["PUT", "", "", "", "", "", "", "", "", "", "", "", canonical_headers]
        )
        + canonical_resource
    )

    signature = base64.b64encode(
        hmac.new(
            base64.b64decode(key),
            string_to_sign.encode("utf-8"),
            hashlib.sha256,
        ).digest()
    ).decode("ascii")

    headers = {
        "x-ms-date": date,
        "x-ms-version": "2023-11-03",
        "Content-Length": "0",
        "Authorization": f"SharedKey {account}:{signature}",
    }

    async with (
        aiohttp.ClientSession() as session,
        session.put(
            url, headers=headers, skip_auto_headers={"Content-Type"}
        ) as response,
    ):
        if response.status not in (201, 409):
            body = await response.text()
            raise RuntimeError(
                f"failed to create Azurite container {container!r}: "
                f"HTTP {response.status} {body}"
            )


@pytest.fixture(scope="session")
def _s3_store() -> S3Store:
    return S3Store(
        os.environ["VT_TEST_S3_BUCKET"],
        endpoint=os.environ["VT_TEST_S3_ENDPOINT"],
        region=os.environ["VT_TEST_S3_REGION"],
        access_key_id=os.environ["VT_TEST_S3_ACCESS_KEY_ID"],
        secret_access_key=os.environ["VT_TEST_S3_SECRET_ACCESS_KEY"],
        virtual_hosted_style_request=False,
        client_options={"allow_http": True},
    )


@pytest.fixture(scope="session")
async def _azure_store() -> AzureStore:
    account = os.environ["VT_TEST_AZURE_ACCOUNT"]
    key = os.environ["VT_TEST_AZURE_KEY"]
    endpoint = os.environ["VT_TEST_AZURE_ENDPOINT"]
    container = os.environ["VT_TEST_AZURE_CONTAINER"]

    await _ensure_azurite_container(account, key, endpoint, container)

    return AzureStore(
        container,
        account_name=account,
        account_key=key,
        endpoint=endpoint,
        client_options={"allow_http": True},
    )


async def _purge(provider: ObstoreProvider, prefix: str) -> None:
    async for info in provider.list(prefix):
        await provider.delete(info.key)


_SANITIZE = str.maketrans({"[": "_", "]": "_", "/": "_", " ": "_"})


def _test_prefix(request: pytest.FixtureRequest, worker_id: str) -> str:
    return f"test/{worker_id}/{request.node.name.translate(_SANITIZE)}/"


@pytest.fixture
async def s3_storage(
    _s3_store: S3Store,
    request: pytest.FixtureRequest,
    worker_id: str,
) -> AsyncIterator[ObstoreProvider]:
    provider = ObstoreProvider(_s3_store)
    prefix = _test_prefix(request, worker_id)
    await _purge(provider, prefix)
    yield provider
    await _purge(provider, prefix)


@pytest.fixture
async def azure_storage(
    _azure_store: AzureStore,
    request: pytest.FixtureRequest,
    worker_id: str,
) -> AsyncIterator[ObstoreProvider]:
    provider = ObstoreProvider(_azure_store)
    prefix = _test_prefix(request, worker_id)
    await _purge(provider, prefix)
    yield provider
    await _purge(provider, prefix)


@pytest.fixture
def memory_storage() -> StorageBackend:
    return MemoryStorageProvider()
