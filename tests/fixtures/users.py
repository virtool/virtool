import pytest

from virtool.auth.permissions import AppPermissions
from virtool.users.utils import Permission


@pytest.fixture
def bob(no_permissions, static_time):
    return {
        "_id": "abc123",
        "handle": "bob",
        "administrator": False,
        "force_reset": False,
        "groups": ["peasants"],
        "last_password_change": static_time.datetime,
        "invalidate_sessions": False,
        "password": "hashed_password",
        "permissions": no_permissions,
        "primary_group": "",
        "settings": {
            "skip_quick_analyze_dialog": True,
            "show_ids": True,
            "show_versions": True,
            "quick_analyze_workflow": "pathoscope_bowtie",
        },
        "active": True
    }


@pytest.fixture
def create_user(static_time):
    def func(
        user_id="test", handle="bob", administrator=False, groups=None, permissions=None
    ):

        permissions = permissions or []

        return {
            "_id": user_id,
            "handle": handle,
            "administrator": administrator,
            "permissions": {perm.value: perm.value in permissions for perm in Permission},
            "groups": groups or [],
            "invalidate_sessions": False,
            "last_password_change": static_time.datetime,
            "primary_group": "technician",
            "api_keys": [],
            "settings": {
                "skip_quick_analyze_dialog": True,
                "show_ids": True,
                "show_versions": True,
                "quick_analyze_workflow": "pathoscope_bowtie",
            },
            "force_reset": False,
            "password": "$2b$12$0aC1WPkTG.up/KQb3KcQVOMkMbThtjMMrFfG5tiILY2cUMVcnEW0.".encode(),
            "active": True
        }

    return func


@pytest.fixture
def all_permissions():
    return {permission.value: True for permission in Permission}


@pytest.fixture
def no_permissions():
    return {permission.value: False for permission in Permission}
