"""Fixtures"""

import asyncio

import openfga_sdk
import pytest
from openfga_sdk import OpenFgaApi

from virtool.authorization.client import AuthorizationClient
from virtool.authorization.openfga import (
    OpenfgaScheme,
    delete_openfga_tuples,
    get_or_create_openfga_store,
    write_openfga_authorization_model,
)
from virtool.authorization.permissions import ResourceType


@pytest.fixture(scope="session")
async def _openfga_api_cache() -> dict[str, OpenFgaApi]:
    cache = {}

    yield cache

    await asyncio.gather(
        *[client.close() for client in cache.values()],
    )


@pytest.fixture()
async def openfga_api(
    _openfga_api_cache: dict[str, OpenFgaApi],
    openfga_host: str,
    openfga_scheme: OpenfgaScheme,
    openfga_store_name: str,
) -> OpenFgaApi:
    """An :class:`AuthorizationClient` instance backed by a testing OpenFGA server."""
    if openfga_store_name in _openfga_api_cache:
        return _openfga_api_cache[openfga_store_name]

    configuration = openfga_sdk.Configuration(
        api_scheme=openfga_scheme.value,
        api_host=openfga_host,
    )

    openfga_api_ = openfga_sdk.OpenFgaApi(openfga_sdk.ApiClient(configuration))

    configuration.store_id = await get_or_create_openfga_store(
        openfga_api_,
        openfga_store_name,
    )

    await write_openfga_authorization_model(openfga_api_)

    _openfga_api_cache[openfga_store_name] = openfga_api_

    return openfga_api_


@pytest.fixture()
async def authorization_client(mocker, openfga_api: OpenFgaApi) -> AuthorizationClient:
    """An :class:`AuthorizationClient` instance backed by a testing OpenFGA server."""
    await asyncio.gather(
        delete_openfga_tuples(openfga_api, ResourceType.SPACE, 0),
        delete_openfga_tuples(openfga_api, ResourceType.APP, "virtool"),
    )

    client = AuthorizationClient(openfga_api)

    mocker.patch.object(client, "close", return_value=None)

    await client.close()

    return client


@pytest.fixture()
def openfga_host(request) -> str:
    """The host for the OpenFGA testing server."""
    return request.config.getoption("openfga_host")


@pytest.fixture()
def openfga_scheme() -> OpenfgaScheme:
    """The scheme used by the OpenFGA testing server."""
    return OpenfgaScheme.HTTP


@pytest.fixture()
def openfga_store_name(worker_id: str) -> str:
    """The name of the OpenFGA store to use.

    If test multiplexing is enabled, a different store name will be used for each
    worker.
    """
    return f"vt-test-{worker_id}"
