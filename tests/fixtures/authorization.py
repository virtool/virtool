import asyncio
from enum import Enum

import openfga_sdk
import pytest
from openfga_sdk import TupleKey, WriteRequest, TupleKeys, ApiException

from virtool.authorization.client import AuthorizationClient
from virtool.authorization.permissions import ResourceType
from virtool.authorization.utils import (
    write_openfga_authorization_model,
    delete_tuples,
    get_or_create_openfga_store,
)


@pytest.fixture
async def authorization_client(openfga_store_name: str) -> AuthorizationClient:
    configuration = openfga_sdk.Configuration(
        api_scheme="http", api_host="localhost:8080"
    )

    api_instance = openfga_sdk.OpenFgaApi(openfga_sdk.ApiClient(configuration))

    configuration.store_id = await get_or_create_openfga_store(
        api_instance, openfga_store_name
    )

    await write_openfga_authorization_model(api_instance)

    await delete_tuples(api_instance, ResourceType.SPACE, 0)

    await delete_tuples(api_instance, ResourceType.APP, "virtool")

    return AuthorizationClient(api_instance)


@pytest.fixture
async def openfga_store_name(worker_id):
    return f"vt-test-{worker_id}"
