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
