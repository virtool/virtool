import pytest


@pytest.fixture
def kings(all_permissions):
    return {"_id": "kings", "permissions": all_permissions}


@pytest.fixture
def peasants(no_permissions):
    return {"_id": "peasants", "permissions": no_permissions}
