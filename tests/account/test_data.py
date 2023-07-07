import pytest
from aiohttp.test_utils import make_mocked_coro
from virtool_core.models.enums import Permission
from virtool_core.models.roles import AdministratorRole

from virtool.account.data import AccountData
from virtool.account.oas import CreateKeysRequest
from virtool.groups.oas import UpdatePermissionsRequest


@pytest.mark.parametrize(
    "administrator_role", [AdministratorRole.FULL, None], ids=["full", "none"]
)
@pytest.mark.parametrize(
    "has_permission", [True, False], ids=["has permission", "missing permission"]
)
async def test_create_api_key(
    administrator_role,
    has_permission,
    mocker,
    mongo,
    snapshot,
    static_time,
    data_layer,
    fake2,
):
    """
    Test that an API key is created correctly with varying key owner administrator status and
    permissions.

    """
    mocker.patch("virtool.account.db.get_alternate_id", make_mocked_coro("foo_0"))

    mocker.patch("virtool.utils.generate_key", return_value=("bar", "baz"))

    group_1 = await fake2.groups.create()
    group_2 = await fake2.groups.create(
        UpdatePermissionsRequest(
            **{
                Permission.create_sample: True,
                Permission.modify_subtraction: has_permission,
            }
        )
    )

    user = await fake2.users.create(
        groups=[group_1, group_2], administrator_role=administrator_role
    )

    _, api_key = await data_layer.account.create_key(
        CreateKeysRequest(
            name="Foo",
            permissions=UpdatePermissionsRequest(
                create_sample=True, modify_subtraction=True
            ),
        ),
        user.id,
    )

    assert api_key == snapshot(name="dl")
    assert await mongo.keys.find_one() == snapshot(name="mongo")
