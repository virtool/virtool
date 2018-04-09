import pytest
import datetime

from virtool.users import PERMISSIONS


@pytest.fixture
def bob(no_permissions, static_time):
    return {
        "_id": "bob",
        "administrator": False,
        "force_reset": False,
        "groups": [
            "peasants"
        ],
        "last_password_change": static_time,
        "identicon": "81b637d8fcd2c6da6359e6963113a1170de795e4b725b84d1e0b4cfd9ec58ce9",
        "invalidate_sessions": False,
        "password": "hashed_password",
        "permissions": no_permissions,
        "primary_group": "",
        "settings": {
            "skip_quick_analyze_dialog": True,
            "show_ids": True,
            "show_versions": True,
            "quick_analyze_algorithm": "pathoscope_bowtie"
        }
    }


@pytest.fixture(scope="session")
def create_user():
    def func(name="test", groups=None, permissions=None):
        permissions = permissions or list()

        return {
            "_id": name,
            "permissions": {perm: perm in permissions for perm in PERMISSIONS},
            "groups": groups or list(),
            "invalidate_sessions": False,
            "last_password_change": datetime.datetime(2015, 10, 6, 20, 0, 0, tzinfo=datetime.timezone.utc),
            "primary_group": "technician",
            "api_keys": [],
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
