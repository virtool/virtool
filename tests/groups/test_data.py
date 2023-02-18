import pytest

from virtool.authorization.client import AuthorizationClient
from virtool.groups.data import GroupsData
from virtool.groups.oas import UpdateGroupRequest


@pytest.fixture
def groups_data(authorization_client, mongo):
    return GroupsData(authorization_client, mongo)


async def test_update(
    authorization_client: AuthorizationClient, groups_data: GroupsData, snapshot
):
    group = await groups_data.create("test")

    assert group.name == "test"

    group = await groups_data.update(group.id, UpdateGroupRequest(name="test2"))

    assert group.name == "test2"

    group = await groups_data.update(
        group.id,
        UpdateGroupRequest(
            **{"permissions": {"create_sample": True, "modify_subtraction": True}}
        ),
    )

    assert group.permissions == snapshot(name="added")

    group = await groups_data.update(
        group.id,
        UpdateGroupRequest(**{"permissions": {"create_sample": False}}),
    )

    assert group.permissions == snapshot(name="removed")
