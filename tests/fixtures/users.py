import pytest

from virtool.users.utils import PERMISSIONS


@pytest.fixture
def bob(no_permissions, static_time):
    return {
        "_id": "bob",
        "administrator": False,
        "force_reset": False,
        "groups": [
            "peasants"
        ],
        "last_password_change": static_time.datetime,
        "identicon": "81b637d8fcd2c6da6359e6963113a1170de795e4b725b84d1e0b4cfd9ec58ce9",
        "invalidate_sessions": False,
        "password": "hashed_password",
        "permissions": no_permissions,
        "primary_group": "",
        "settings": {
            "skip_quick_analyze_dialog": True,
            "show_ids": True,
            "show_versions": True,
            "quick_analyze_workflow": "pathoscope_bowtie"
        }
    }


@pytest.fixture
def create_user(static_time):
    def func(name="test", administrator=False, groups=None, permissions=None):

        permissions = permissions or list()

        return {
            "_id": name,
            "administrator": administrator,
            "identicon": "identicon",
            "permissions": {perm: perm in permissions for perm in PERMISSIONS},
            "groups": groups or list(),
            "invalidate_sessions": False,
            "last_password_change": static_time.datetime,
            "primary_group": "technician",
            "api_keys": [],
            "settings": {
                "skip_quick_analyze_dialog": True,
                "show_ids": True,
                "show_versions": True,
                "quick_analyze_workflow": "pathoscope_bowtie"
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
