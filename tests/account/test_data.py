import asyncio

import pytest
from aiohttp.test_utils import make_mocked_coro
from virtool_core.models.enums import Permission

from virtool.account.data import AccountData
from virtool.account.oas import CreateKeysRequest
from virtool.groups.oas import UpdatePermissionsRequest


@pytest.mark.parametrize(
    "administrator", [True, False], ids=["administrator", "limited"]
)
@pytest.mark.parametrize(
    "has_permission", [True, False], ids=["has permission", "missing permission"]
)
async def test_create_api_key(
    administrator, has_permission, mocker, mongo, redis, snapshot, static_time, fake2
):
    """
    Test that an API key is created correctly with varying key owner administrator status and
    permissions.

    """
    mocker.patch("virtool.account.db.get_alternate_id", make_mocked_coro("foo_0"))

    mocker.patch("virtool.utils.generate_key", return_value=("bar", "baz"))

    group1, group2 = await asyncio.gather(fake2.groups.create(), fake2.groups.create())

    # Vary the key owner's administrator status and permissions.
    await mongo.users.insert_one(
        {
            "_id": "bob",
            "administrator": administrator,
            "groups": [group_1.id, group_2.id],
            "permissions": {
                Permission.create_sample.value: True,
                "modify_subtraction": has_permission,
            },
        }
    )

    account_data = AccountData(mongo, redis)

    _, api_key = await account_data.create_key(
        CreateKeysRequest(
            name="Foo",
            permissions=UpdatePermissionsRequest(
                create_sample=True, modify_subtraction=True
            ),
        ),
        "bob",
    )

    assert api_key == snapshot(name="dl")
    assert await mongo.keys.find_one() == snapshot(name="mongo")
