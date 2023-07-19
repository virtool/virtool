"""Fixtures"""
import openfga_sdk
import pytest

from virtool.authorization.client import AuthorizationClient
from virtool.authorization.openfga import (
    OpenfgaScheme,
    delete_openfga_tuples,
    get_or_create_openfga_store,
    write_openfga_authorization_model,
)
from virtool.authorization.permissions import ResourceType


@pytest.fixture
async def authorization_client(
    openfga_host: str, openfga_scheme, openfga_store_name: str
) -> AuthorizationClient:
    """An :class:`AuthorizationClient` instance backed by a testing OpenFGA server."""
    configuration = openfga_sdk.Configuration(
        api_scheme=openfga_scheme.value, api_host=openfga_host
    )

    api_instance = openfga_sdk.OpenFgaApi(openfga_sdk.ApiClient(configuration))

    configuration.store_id = await get_or_create_openfga_store(
        api_instance, openfga_store_name
    )

    await write_openfga_authorization_model(api_instance)
    await delete_openfga_tuples(api_instance, ResourceType.SPACE, 0)
    await delete_openfga_tuples(api_instance, ResourceType.APP, "virtool")

    yield AuthorizationClient(api_instance)

    authorization_client = AuthorizationClient(api_instance)

    yield authorization_client

    await authorization_client.close()


@pytest.fixture
def openfga_host(request):
    """The host of the OpenFGA server."""
    return request.config.getoption("openfga_host")


@pytest.fixture
def openfga_scheme() -> OpenfgaScheme:
    """
    The scheme used by the OpenFGA server.
    """
    return OpenfgaScheme.HTTP


@pytest.fixture
def openfga_store_name(worker_id: str) -> str:
    """
    The name for the OpenFGA store.
    """
    return f"vt-test-{worker_id}"
