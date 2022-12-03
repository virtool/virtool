import openfga_sdk
import pytest
from openfga_sdk.api import open_fga_api
from virtool_core.models.enums import Permission

from virtool.auth.utils import write_tuple


@pytest.fixture()
async def delete_store():
    """
    Delete the store.
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


@pytest.mark.parametrize("db", ["mongo", "open_fga"])
@pytest.mark.parametrize("has_permission", [True, False])
async def test_check(delete_store, db, has_permission, spawn_client):
    client = await spawn_client(authorize=True, permissions=[Permission.cancel_job])
    abs_client = client.app["auth"]

    if has_permission:
        permission = Permission.cancel_job
    else:
        permission = Permission.modify_subtraction

    if db == "mongo":
        response = await abs_client.check("test", permission, "app", "virtool")

        # assert await check_in_mongo(abs_client.mongo, "test", permission) is has_permission

    else:
        await write_tuple(
            abs_client.open_fga,
            "user",
            "ryanf",
            Permission.cancel_job,
            "app",
            "virtool",
        )

        response = await abs_client.check("ryanf", permission, "app", "virtool")

        # assert await check_in_open_fga(abs_client.open_fga, "ryanf", permission, "app", "virtool") is has_permission

    assert response is has_permission


@pytest.mark.parametrize("db", ["mongo", "open_fga"])
async def test_list(delete_store, db, spawn_client, snapshot):
    client = await spawn_client(authorize=True, permissions=[Permission.cancel_job])

    abs_client = client.app["auth"]

    if db == "mongo":
        response = await abs_client.list_permissions("test", "app", "virtool")
    else:
        await write_tuple(
            abs_client.open_fga, "user", "ryanf", "member", "group", "sidney"
        )

        await write_tuple(
            abs_client.open_fga,
            "group",
            "sidney#member",
            "cancel_job",
            "app",
            "virtool",
        )

        await write_tuple(
            abs_client.open_fga,
            "group",
            "sidney#member",
            "create_ref",
            "app",
            "virtool",
        )

        response = await abs_client.list_permissions("ryanf", "app", "virtool")

    assert response == snapshot


@pytest.mark.parametrize("db", ["mongo", "open_fga"])
async def test_add_group_permissions(delete_store, setup_update_group, db, snapshot):
    client, group = setup_update_group

    abs_client = client.app["auth"]

    if db == "mongo":

        await abs_client.add_group_permissions(
            group.id,
            [Permission.cancel_job, Permission.modify_subtraction],
            "app",
            "virtool",
        )

        assert (
                await client.db.users.find({}, ["groups", "permissions"]).to_list(None)
                == snapshot
        )

    else:

        await write_tuple(
            abs_client.open_fga, "user", "ryanf", "member", "group", "sidney"
        )

        await abs_client.add_group_permissions(
            "sidney",
            [Permission.cancel_job, Permission.modify_subtraction],
            "app",
            "virtool",
        )

        assert await abs_client.list_permissions("ryanf", "app", "virtool") == snapshot


async def test_add_user_permissions(delete_store, spawn_client, snapshot):
    client = await spawn_client(authorize=True)

    abs_client = client.app["auth"]

    await abs_client.add_user_permissions(
        "ryanf",
        [Permission.cancel_job],
        "app",
        "virtool",
    )

    assert await abs_client.list_permissions("ryanf", "app", "virtool") == snapshot


@pytest.mark.parametrize("db", ["mongo", "open_fga"])
async def test_remove_group_permissions(mongo, delete_store, db, setup_update_group, snapshot):
    client, group = setup_update_group

    abs_client = client.app["auth"]

    if db == "mongo":
        await mongo.groups.find_one_and_update(
            {"_id": group.id},
            {"$set": {"permissions.cancel_job": True, "permissions.create_ref": True}},
        )

        await abs_client.remove_group_permissions(group.id, [Permission.cancel_job], "app", "virtool")

        assert (
                await client.db.users.find({}, ["groups", "permissions"]).to_list(None)
                == snapshot
        )

    else:
        await write_tuple(
            abs_client.open_fga, "user", "ryanf", "member", "group", "sidney"
        )

        await write_tuple(
            abs_client.open_fga,
            "group",
            "sidney#member",
            "cancel_job",
            "app",
            "virtool",
        )

        await write_tuple(
            abs_client.open_fga,
            "group",
            "sidney#member",
            "create_ref",
            "app",
            "virtool",
        )

        await abs_client.remove_group_permissions("sidney", [Permission.cancel_job], "app", "virtool")

        assert await abs_client.list_permissions("ryanf", "app", "virtool") == snapshot


async def test_remove_user_permissions(delete_store, spawn_client, snapshot):
    client = await spawn_client(authorize=True)

    abs_client = client.app["auth"]

    await write_tuple(
        abs_client.open_fga,
        "user",
        "ryanf",
        Permission.cancel_job,
        "app",
        "virtool",
    )

    await write_tuple(
        abs_client.open_fga,
        "user",
        "ryanf",
        Permission.modify_subtraction,
        "app",
        "virtool",
    )

    await abs_client.remove_user_permissions("ryanf", [Permission.cancel_job], "app", "virtool")

    assert await abs_client.list_permissions("ryanf", "app", "virtool") == snapshot
