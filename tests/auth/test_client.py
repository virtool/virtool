import openfga_sdk
import pytest
from openfga_sdk.api import open_fga_api
from virtool_core.models.enums import Permission

from virtool.auth.client import AuthorizationClient
from virtool.auth.relationships import GroupPermission, UserPermission, GroupMembership
from virtool.auth.utils import write_tuple, connect_openfga


@pytest.fixture()
def spawn_auth_client(mongo, data_layer, create_user):
    async def func(
        permissions=None,
    ):
        user_document = create_user(
            user_id="test",
            permissions=permissions,
        )
        await mongo.users.insert_one(user_document)

        open_fga_client = await connect_openfga("localhost:8080", "http")

        return AuthorizationClient(mongo, open_fga_client, data_layer)

    return func


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
async def test_check(delete_store, db, has_permission, spawn_auth_client):
    abs_client = await spawn_auth_client(permissions=[Permission.cancel_job])

    if has_permission:
        permission = Permission.cancel_job
    else:
        permission = Permission.modify_subtraction

    if db == "mongo":
        response = await abs_client.check("test", permission, "app", "virtool")

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

    assert response is has_permission


@pytest.mark.parametrize("db", ["mongo", "open_fga"])
async def test_list(delete_store, db, spawn_auth_client, snapshot):
    abs_client = await spawn_auth_client(permissions=[Permission.cancel_job])

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
async def test_add_to_group(
    db, spawn_auth_client, delete_store, fake2, snapshot, mongo
):
    abs_client = await spawn_auth_client(permissions=[Permission.cancel_job])

    if db == "mongo":

        group = await fake2.groups.create()

        await fake2.users.create()

        user = await fake2.users.create()

        await abs_client.add(GroupMembership(user.id, group.id, ["member"]))

        assert await mongo.users.find({}, ["groups"]).to_list(None) == snapshot
    else:
        await abs_client.add(GroupMembership("ryanf", "sidney", ["member"]))

        await abs_client.add(
            GroupPermission(
                "sidney", [Permission.cancel_job, Permission.modify_subtraction]
            )
        )

        assert await abs_client.list_permissions("ryanf", "app", "virtool") == snapshot


@pytest.mark.parametrize("db", ["mongo", "open_fga"])
async def test_add_group_permissions(
    delete_store, fake2, spawn_auth_client, mongo, db, snapshot
):
    abs_client = await spawn_auth_client()

    group = await fake2.groups.create()
    await fake2.groups.create()

    await fake2.users.create()
    await fake2.users.create(groups=[group])
    await fake2.users.create(groups=[group])
    await fake2.users.create(groups=[group])

    if db == "mongo":

        await abs_client.add(
            GroupPermission(
                group.id, [Permission.cancel_job, Permission.modify_subtraction]
            )
        )

        assert (
            await mongo.users.find({}, ["groups", "permissions"]).to_list(None)
            == snapshot
        )

    else:

        await write_tuple(
            abs_client.open_fga, "user", "ryanf", "member", "group", "sidney"
        )

        await abs_client.add(
            GroupPermission(
                "sidney", [Permission.cancel_job, Permission.modify_subtraction]
            )
        )

        assert await abs_client.list_permissions("ryanf", "app", "virtool") == snapshot


async def test_add_user_permissions(delete_store, spawn_auth_client, snapshot):
    abs_client = await spawn_auth_client(permissions=[Permission.cancel_job])

    await abs_client.add(UserPermission("ryanf", [Permission.cancel_job]))

    assert await abs_client.list_permissions("ryanf", "app", "virtool") == snapshot


@pytest.mark.parametrize("db", ["mongo", "open_fga"])
async def test_remove_group_permissions(
    mongo, delete_store, db, spawn_auth_client, snapshot, fake2
):
    abs_client = await spawn_auth_client()

    group = await fake2.groups.create()
    await fake2.groups.create()

    await fake2.users.create()
    await fake2.users.create(groups=[group])
    await fake2.users.create(groups=[group])
    await fake2.users.create(groups=[group])

    if db == "mongo":
        await mongo.groups.find_one_and_update(
            {"_id": group.id},
            {"$set": {"permissions.cancel_job": True, "permissions.create_ref": True}},
        )

        await abs_client.remove(GroupPermission(group.id, [Permission.cancel_job]))

        assert (
            await mongo.users.find({}, ["groups", "permissions"]).to_list(None)
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

        await abs_client.remove(GroupPermission("sidney", [Permission.cancel_job]))

        assert await abs_client.list_permissions("ryanf", "app", "virtool") == snapshot


async def test_remove_user_permissions(delete_store, spawn_auth_client, snapshot):
    abs_client = await spawn_auth_client(permissions=[Permission.cancel_job])

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

    await abs_client.remove(UserPermission("ryanf", [Permission.cancel_job]))

    assert await abs_client.list_permissions("ryanf", "app", "virtool") == snapshot
