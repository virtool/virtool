import pytest

from virtool.permissions import PERMISSIONS


@pytest.fixture
def all_permissions():
    return {permission: True for permission in PERMISSIONS}


@pytest.fixture
def no_permissions():
    return {permission: False for permission in PERMISSIONS}


@pytest.fixture
def base_groups(all_permissions, no_permissions):
    return {
        "administrator": {
            "_id": "administrator",
            "permissions": all_permissions
        },

        "limited": {
            "_id": "limited",
            "permissions": no_permissions
        },

        "moderator": {
            "_id": "moderator",
            "permissions": dict(all_permissions, modify_options=False)
        },

        "technician": {
            "_id": "technician",
            "permissions": dict(no_permissions, add_sample=True, cancel_job=True)
        }
    }


@pytest.fixture
def make_groups(base_groups):
    def func(*args):
        return [base_groups[group_id] for group_id in args]

    return func


@pytest.fixture
def mangled_password():
    return "f0f8f5775f63c272dd835a445745e981a35fa8b978caf62a878427916af71c14e481084b8d36492d581f8f263015657cb41f24b" \
           "873ad1c8e1bcb8514c8b5a91d"
