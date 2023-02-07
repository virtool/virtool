import asyncio

import pytest


@pytest.fixture
async def setup_auth_update_group(spawn_auth_client, fake2):
    abs_client = await spawn_auth_client()

    group = await fake2.groups.create()

    await asyncio.gather(
        *[
            fake2.groups.create(),
            fake2.users.create(),
            fake2.users.create(groups=[group]),
            fake2.users.create(groups=[group]),
            fake2.users.create(groups=[group]),
        ]
    )

    return abs_client, group


@pytest.fixture
async def setup_auth_update_user(spawn_auth_client, fake2, mongo):
    abs_client = await spawn_auth_client()

    group1 = await fake2.groups.create()
    group2 = await fake2.groups.create()

    await mongo.groups.update_one(
        {"_id": group1.id},
        {"$set": {"permissions.cancel_job": True, "permissions.create_ref": True}},
    )

    await mongo.groups.update_one(
        {"_id": group2.id},
        {
            "$set": {"permissions.modify_subtraction": True},
        },
    )

    await fake2.users.create(groups=[group1])

    return abs_client, group1, group2, await fake2.users.create(groups=[group1])
