import pytest

from virtool.permissions import PERMISSIONS


@pytest.fixture(scope="session")
def create_user():
    def func(name="test", groups=None, permissions=None):
        permissions = permissions or list()

        return {
            "_id": name,
            "permissions": {perm: perm in permissions for perm in PERMISSIONS},
            "groups": groups or list(),
            "invalidate_sessions": False,
            "last_password_change": "2017-10-06T13:00:00.000000",
            "primary_group": "",
            "settings": {
                "skip_quick_analyze_dialog": True,
                "show_ids": True,
                "show_versions": True,
                "quick_analyze_algorithm": "pathoscope_bowtie"
            },
            "force_reset": False,
            "password": "$2b$12$0aC1WPkTG.up/KQb3KcQVOMkMbThtjMMrFfG5tiILY2cUMVcnEW0.".encode()
        }

    return func


@pytest.fixture
def all_permissions():
    return {permission: True for permission in PERMISSIONS}


@pytest.fixture
def no_permissions():
    return {permission: False for permission in PERMISSIONS}
