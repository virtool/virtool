import asyncio

import openfga_sdk
import pytest
from openfga_sdk.api import open_fga_api
from virtool_core.models.enums import Permission

from virtool.auth.client import AuthorizationClient
from virtool.auth.mongo import check_in_mongo, list_permissions_in_mongo
from virtool.auth.openfga import check_in_open_fga, list_permissions_in_open_fga, list_groups
from virtool.auth.relationships import GroupPermission, UserPermission, GroupMembership
from virtool.auth.utils import write_tuple, connect_openfga


@pytest.fixture()
def spawn_auth_client(mongo, create_user):
    async def func(
        permissions=None,
    ):
        user_document = create_user(
            user_id="test",
            permissions=permissions,
        )
        _, open_fga_instance = await asyncio.gather(
            *[
                mongo.users.insert_one(user_document),
                connect_openfga("localhost:8080", "http"),
            ]
        )

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


class TestCheck:
    @pytest.mark.parametrize("has_permission", [True, False])
    async def test_mongo(self, spawn_auth_client, has_permission):
        abs_client = await spawn_auth_client(permissions=[Permission.cancel_job])

        if has_permission:
            permission = Permission.cancel_job
        else:
            permission = Permission.modify_subtraction

        response = await abs_client.check("test", permission, "app", "virtool")

        assert response is has_permission

        assert (
            await check_in_mongo(abs_client.mongo, "test", permission) is has_permission
        )

    @pytest.mark.parametrize("has_permission", [True, False])
    async def test_open_fga(self, delete_store, has_permission, spawn_auth_client):
        abs_client = await spawn_auth_client()

        if has_permission:
            permission = Permission.cancel_job
        else:
            permission = Permission.modify_subtraction

        await write_tuple(
            abs_client.open_fga,
            "user",
            "ryanf",
            [Permission.cancel_job],
            "app",
            "virtool",
        )

        assert (
            await abs_client.check("ryanf", permission, "app", "virtool")
            is has_permission
        )

        assert (
            await check_in_open_fga(
                abs_client.open_fga, "ryanf", permission, "app", "virtool"
            )
            is has_permission
        )


class TestList:
    async def test_mongo(self, spawn_auth_client, snapshot):
        abs_client = await spawn_auth_client(permissions=[Permission.cancel_job])

        response = await abs_client.list_permissions("test", "app", "virtool")

        assert response == snapshot

        assert await list_permissions_in_mongo(abs_client.mongo, "test") == response

    async def test_open_fga(self, delete_store, spawn_auth_client, snapshot):

        abs_client = await spawn_auth_client()

        await asyncio.gather(
            *[
                write_tuple(
                    abs_client.open_fga, "user", "ryanf", ["member"], "group", "sidney"
                ),
                write_tuple(
                    abs_client.open_fga,
                    "group",
                    "sidney#member",
                    [Permission.cancel_job, Permission.create_ref],
                    "app",
                    "virtool",
                ),
            ]
        )

        response = await abs_client.list_permissions("ryanf", "app", "virtool")

        assert response == snapshot

        assert (
            await list_permissions_in_open_fga(
                abs_client.open_fga, "ryanf", "app", "virtool"
            )
            == response
        )


class TestAddGroupMembership:
    async def test_mongo(self, fake2, snapshot, mongo, setup_auth_update_user):
        abs_client, _, group2, user = setup_auth_update_user

        await abs_client.add(GroupMembership(user.id, group2.id, ["member"]))

        assert await mongo.users.find({}, ["groups", "permissions"]).to_list(None) == snapshot

    async def test_open_fga(
        self, delete_store, fake2, snapshot, spawn_auth_client
    ):
        abs_client = await spawn_auth_client()

        await asyncio.gather(
            *[
                abs_client.add(GroupMembership("ryanf", "sidney", ["member"])),
                write_tuple(
                    abs_client.open_fga,
                    "group",
                    "sidney#member",
                    [Permission.cancel_job, Permission.modify_subtraction],
                    "app",
                    "virtool",
                ),
            ]
        )

        assert await list_groups(abs_client.open_fga, "ryanf") == snapshot(name="groups")
        assert await abs_client.list_permissions("ryanf", "app", "virtool") == snapshot(name="permissions")


class TestRemoveGroupMembership:
    async def test_mongo(self, fake2, snapshot, mongo, setup_auth_update_user):
        abs_client, group1, _, user = setup_auth_update_user

        await abs_client.remove(GroupMembership(user.id, group1.id, ["member"]))

        assert await mongo.users.find({}, ["groups", "permissions"]).to_list(None) == snapshot

    async def test_open_fga(
        self, delete_store, fake2, snapshot, spawn_auth_client
    ):
        abs_client = await spawn_auth_client()

        await asyncio.gather(
            *[
                write_tuple(
                    abs_client.open_fga, "user", "ryanf", ["member"], "group", "sidney"
                ),
                write_tuple(
                    abs_client.open_fga, "user", "bob", ["member"], "group", "sidney"
                ),
                write_tuple(
                    abs_client.open_fga,
                    "group",
                    "sidney#member",
                    [Permission.cancel_job, Permission.modify_subtraction],
                    "app",
                    "virtool",
                ),
            ]
        )

        await abs_client.remove(GroupMembership("ryanf", "sidney", ["member"]))

        assert await list_groups(abs_client.open_fga, "ryanf") == snapshot(name="ryanf_groups")
        assert await abs_client.list_permissions("ryanf", "app", "virtool") == snapshot(name="ryanf_permissions")

        assert await list_groups(abs_client.open_fga, "bob") == snapshot(name="bob_groups")
        assert await abs_client.list_permissions("bob", "app", "virtool") == snapshot(name="bob_permissions")


class TestAddPermissions:
    async def test_mongo(
        self, fake2, setup_auth_update_group, mongo, snapshot
    ):
        abs_client, group = setup_auth_update_group

        await abs_client.add(
            GroupPermission(
                group.id, [Permission.cancel_job, Permission.modify_subtraction]
            )
        )

        assert (
            await mongo.users.find({}, ["groups", "permissions"]).to_list(None)
            == snapshot
        )

    async def test_open_fga_group(
        self, delete_store, fake2, spawn_auth_client, snapshot
    ):
        abs_client = await spawn_auth_client()

        await asyncio.gather(
            *[
                write_tuple(
                    abs_client.open_fga, "user", "ryanf", ["member"], "group", "sidney"
                ),
                abs_client.add(
                    GroupPermission(
                        "sidney", [Permission.cancel_job, Permission.modify_subtraction]
                    )
                ),
            ]
        )

        assert await abs_client.list_permissions("ryanf", "app", "virtool") == snapshot

    async def test_open_fga_user(
        self, delete_store, fake2, spawn_auth_client, snapshot
    ):
        abs_client = await spawn_auth_client()

        await abs_client.add(UserPermission("ryanf", [Permission.cancel_job]))

        assert await abs_client.list_permissions("ryanf", "app", "virtool") == snapshot


class TestRemovePermissions:
    async def test_mongo(self, mongo, setup_auth_update_group, snapshot, fake2):
        abs_client, group = setup_auth_update_group

        await mongo.groups.update_one(
            {"_id": group.id},
            {"$set": {"permissions.cancel_job": True, "permissions.create_ref": True}},
        )

        await abs_client.remove(GroupPermission(group.id, [Permission.cancel_job]))

        assert (
            await mongo.users.find({}, ["groups", "permissions"]).to_list(None)
            == snapshot
        )

    async def test_open_fga_group(
        self, delete_store, spawn_auth_client, snapshot, fake2
    ):
        abs_client = await spawn_auth_client()

        await asyncio.gather(
            *[
                write_tuple(
                    abs_client.open_fga, "user", "ryanf", ["member"], "group", "sidney"
                ),
                write_tuple(
                    abs_client.open_fga,
                    "group",
                    "sidney#member",
                    [Permission.cancel_job, Permission.create_ref],
                    "app",
                    "virtool",
                ),
            ]
        )

        await abs_client.remove(GroupPermission("sidney", [Permission.cancel_job]))

        assert await abs_client.list_permissions("ryanf", "app", "virtool") == snapshot

    async def test_open_fga_user(
        self, delete_store, spawn_auth_client, snapshot, fake2
    ):
        abs_client = await spawn_auth_client(permissions=[Permission.cancel_job])

        await write_tuple(
            abs_client.open_fga,
            "user",
            "ryanf",
            [Permission.cancel_job, Permission.modify_subtraction],
            "app",
            "virtool",
        )

        await abs_client.remove(UserPermission("ryanf", [Permission.cancel_job]))

        assert await abs_client.list_permissions("ryanf", "app", "virtool") == snapshot
