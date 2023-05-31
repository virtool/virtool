import openfga_sdk
import pytest
from openfga_sdk import ApiException, TupleKey, TupleKeys, WriteRequest

from virtool.authorization.client import AuthorizationClient
from virtool.authorization.openfga import OpenfgaScheme
from virtool.authorization.permissions import ResourceType
from virtool.authorization.utils import (
    delete_tuples,
    get_or_create_openfga_store,
    write_openfga_authorization_model,
)


@pytest.fixture
def openfga_host():
    return "localhost:8080"


@pytest.fixture
def openfga_scheme() -> OpenfgaScheme:
    return OpenfgaScheme.HTTP


@pytest.fixture
async def openfga_store_name(worker_id, loop):
    return f"vt-test-{worker_id}"


@pytest.fixture
async def authorization_client(
    openfga_host: str, openfga_scheme, openfga_store_name: str
) -> AuthorizationClient:
    configuration = openfga_sdk.Configuration(
        api_scheme=openfga_scheme.value, api_host=openfga_host
    )

    api_instance = openfga_sdk.OpenFgaApi(openfga_sdk.ApiClient(configuration))

    configuration.store_id = await get_or_create_openfga_store(
        api_instance, openfga_store_name
    )

    await write_openfga_authorization_model(api_instance)

    await delete_tuples(api_instance, ResourceType.SPACE, 0)

    await delete_tuples(api_instance, ResourceType.APP, "virtool")

    return AuthorizationClient(api_instance)
