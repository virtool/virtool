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
async def _authorization_client_cache() -> dict[str, [AuthorizationClient, OpenFgaApi]]:
    cache = {}

    yield cache

    await asyncio.gather(
        *[client.close() for client, _ in cache.values()],
    )


@pytest.fixture()
async def _authorization_client_openfga_api(
    _authorization_client_cache: dict[str, tuple[AuthorizationClient, OpenFgaApi]],
    openfga_host: str,
    openfga_scheme,
    openfga_store_name: str,
) -> tuple[AuthorizationClient, OpenFgaApi]:
    """An :class:`AuthorizationClient` instance backed by a testing OpenFGA server."""
    if openfga_store_name in _authorization_client_cache:
        return _authorization_client_cache[openfga_store_name]

    configuration = openfga_sdk.Configuration(
        api_scheme=openfga_scheme.value,
        api_host=openfga_host,
    )

    api_instance = openfga_sdk.OpenFgaApi(openfga_sdk.ApiClient(configuration))

    configuration.store_id = await get_or_create_openfga_store(
        api_instance,
        openfga_store_name,
    )

    await write_openfga_authorization_model(api_instance)

    authorization_client = AuthorizationClient(api_instance)

    _authorization_client_cache[openfga_store_name] = authorization_client, api_instance

    return authorization_client, api_instance


@pytest.fixture()
async def authorization_client(
    _authorization_client_openfga_api: tuple[AuthorizationClient, OpenFgaApi],
    openfga_host: str,
    openfga_scheme,
    openfga_store_name: str,
) -> AuthorizationClient:
    """An :class:`AuthorizationClient` instance backed by a testing OpenFGA server."""
    authorization_client, openfga_api = _authorization_client_openfga_api

    await asyncio.gather(
        delete_openfga_tuples(openfga_api, ResourceType.SPACE, 0),
        delete_openfga_tuples(openfga_api, ResourceType.APP, "virtool"),
    )

    return authorization_client


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
