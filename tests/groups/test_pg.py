from virtool.groups.pg import merge_group_permissions
from virtool.users.utils import generate_base_permissions


async def test_merge_group_permissions():
    """Test that permissions from multiple group-like dictionaries can be merged."""
    assert merge_group_permissions(
        [
            {"permissions": permissions}
            for permissions in [
                generate_base_permissions(),
                {**generate_base_permissions(), "modify_subtraction": True},
                {
                    **generate_base_permissions(),
                    "create_sample": True,
                    "modify_subtraction": True,
                },
                generate_base_permissions(),
                {**generate_base_permissions(), "upload_sample": True},
            ]
        ]
    ) == {
        **generate_base_permissions(),
        "create_sample": True,
        "modify_subtraction": True,
    }
