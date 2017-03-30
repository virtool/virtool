import pytest

from virtool.permissions import PERMISSIONS


@pytest.fixture
def all_permissions():
    return {permission: True for permission in PERMISSIONS}


@pytest.fixture
def no_permissions():
    return {permission: False for permission in PERMISSIONS}


@pytest.fixture(scope="session")
def user_document():
    def create_user(name="test", permissions=None, administrator=False):
        if isinstance(permissions, list):
            pass
        elif permissions == "all" or administrator:
            permissions = list(PERMISSIONS)
        else:
            permissions = list()

        permissions = {key: key in permissions for key in PERMISSIONS}

        groups = list()

        if administrator:
            groups.append("administrator")

        return {
            "_id": name,
            "permissions": permissions,
            "groups": groups
        }

    return create_user
