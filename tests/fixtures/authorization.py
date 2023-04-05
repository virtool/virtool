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
async def setup_auth_update_group(spawn_auth_client, fake2):
    abs_client = await spawn_auth_client()

    group = await fake2.groups.create()

    await asyncio.gather(
        *[
            fake2.groups.create(),
            fake2.users.create(),
            fake2.users.create(groups=[group]),
            fake2.users.create(groups=[group]),
            fake2.users.create(groups=[group]),
        ]
    )

    return abs_client, group


@pytest.fixture
async def setup_auth_update_user(spawn_auth_client, fake2, mongo):
    abs_client = await spawn_auth_client()

    group1 = await fake2.groups.create()
    group2 = await fake2.groups.create()

    await mongo.groups.update_one(
        {"_id": group1.id},
        {"$set": {"permissions.cancel_job": True, "permissions.create_ref": True}},
    )

    await mongo.groups.update_one(
        {"_id": group2.id},
        {
            "$set": {"permissions.modify_subtraction": True},
        },
    )

    await fake2.users.create(groups=[group1])

    return abs_client, group1, group2, await fake2.users.create(groups=[group1])


@pytest.fixture
async def openfga_store_name(worker_id):
    return f"vt-test-{worker_id}"


@pytest.fixture
def write_openfga_tuple(authorization_client):
    """
    Write a relationship tuple in OpenFGA.
    """

    async def func(user_type, user_id, relations, object_type, object_name):
        try:
            await authorization_client.open_fga.write(
                WriteRequest(
                    writes=TupleKeys(
                        tuple_keys=[
                            TupleKey(
                                user=f"{user_type}:{user_id}",
                                relation=relation.name
                                if isinstance(relation, Enum)
                                else relation,
                                object=f"{object_type}:{object_name}",
                            )
                            for relation in relations
                        ]
                    )
                )
            )
        except ApiException:
            pass

    return func
