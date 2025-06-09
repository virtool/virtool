import pytest

from virtool.models.enums import Permission


@pytest.fixture()
def all_permissions():
    return {permission.value: True for permission in Permission}


@pytest.fixture()
def no_permissions():
    return {permission.value: False for permission in Permission}


@pytest.fixture()
def kings(all_permissions):
    return {"_id": "kings", "permissions": all_permissions}


@pytest.fixture()
def peasants(no_permissions):
    return {"_id": "peasants", "permissions": no_permissions}
