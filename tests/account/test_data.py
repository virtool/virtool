import pytest
from aiohttp.test_utils import make_mocked_coro
from syrupy import SnapshotAssertion
from virtool_core.models.enums import Permission

from virtool.account.oas import CreateKeysRequest
from virtool.data.layer import DataLayer
from virtool.fake.next import DataFaker
from virtool.groups.oas import PermissionsUpdate
from virtool.mongo.core import Mongo


@pytest.mark.parametrize(
    "has_permission", [True, False], ids=["has_permission", "does_not_have_permission"]
)
async def test_create_api_key(
    has_permission: bool,
    data_layer: DataLayer,
    fake2: DataFaker,
    mocker,
    mongo: Mongo,
    snapshot: SnapshotAssertion,
    static_time,
):
    """
    Test that an API key is created correctly with varying key owner administrator status and
    permissions.

    """
    mocker.patch("virtool.account.mongo.get_alternate_id", make_mocked_coro("foo_0"))
    mocker.patch("virtool.utils.generate_key", return_value=("bar", "baz"))

    group_1 = await fake2.groups.create()
    group_2 = await fake2.groups.create(
        PermissionsUpdate(
            **{
                Permission.create_sample: True,
                Permission.modify_subtraction: has_permission,
            }
        )
    )

    user = await fake2.users.create(groups=[group_1, group_2])

    _, api_key = await data_layer.account.create_key(
        CreateKeysRequest(
            name="Foo",
            permissions=PermissionsUpdate(create_sample=True, modify_subtraction=True),
        ),
        user.id,
    )

    assert api_key == snapshot(name="data")
    assert await mongo.keys.find_one() == snapshot(name="mongo")
