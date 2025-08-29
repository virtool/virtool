import pytest

from virtool.models.enums import Permission


@pytest.fixture
def all_permissions():
    return {permission.value: True for permission in Permission}


@pytest.fixture
def no_permissions():
    return {permission.value: False for permission in Permission}
