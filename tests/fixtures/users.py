import pytest
import datetime

from virtool.user_permissions import PERMISSIONS


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
