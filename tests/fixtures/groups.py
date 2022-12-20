import pytest


@pytest.fixture
def kings(all_permissions):
    return {"_id": "kings", "permissions": all_permissions}


@pytest.fixture
def peasants(no_permissions):
    return {"_id": "peasants", "permissions": no_permissions}


@pytest.fixture
async def setup_update_group(spawn_client, fake2):
    client = await spawn_client(authorize=True, administrator=True)

    group = await fake2.groups.create()
    await fake2.groups.create()

    await fake2.users.create()
    await fake2.users.create(groups=[group])
    await fake2.users.create(groups=[group])
    await fake2.users.create(groups=[group])

    return client, group
