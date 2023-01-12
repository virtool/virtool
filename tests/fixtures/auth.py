import asyncio

import openfga_sdk
import pytest
from openfga_sdk.api import open_fga_api

from virtool.auth.client import AuthorizationClient
from virtool.auth.utils import connect_openfga


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


@pytest.fixture()
def spawn_auth_client(mongo, create_user):
    async def func(
        permissions=None,
        skip_user=None,
    ):

        if not skip_user:
            await mongo.users.insert_one(
                create_user(
                    user_id="test",
                    permissions=permissions,
                )
            )

        open_fga_instance = await connect_openfga("localhost:8080", "http")

        return AuthorizationClient(mongo, open_fga_instance)

    return func


@pytest.fixture()
async def delete_store():
    """
    Delete stores.
    """

    configuration = openfga_sdk.Configuration(
        api_scheme="http", api_host="localhost:8080"
    )
    api_client = open_fga_api.ApiClient(configuration)
    api_instance = open_fga_api.OpenFgaApi(api_client)

    response = await api_instance.list_stores()

    for store in response.stores:
        configuration.store_id = store.id
        await api_instance.delete_store()
