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
            "last_password_change": "2017-02-06T13:00:00.000000",
            "primary_group": "",
            "settings": {
                "skip_quick_analyze_dialog": True,
                "show_ids": True,
                "show_versions": True,
                "quick_analyze_algorithm": "pathoscope_bowtie"
            },
            "force_reset": False,
            "salt": "8699041ecb71763ccef7937e",
            "password": "cbd4df372a380f57b45ba76b73e0e778cdd4edf881ef3db6a2232db02f1d2bb5"
                        "dd1489a2b10fa055d09924169f598d5094cd47e60c398b011df2a3cf03039ae1"

        }

    return func


@pytest.fixture
def all_permissions():
    return {permission: True for permission in PERMISSIONS}


@pytest.fixture
def no_permissions():
    return {permission: False for permission in PERMISSIONS}
