from http import HTTPStatus

import pytest
from syrupy.assertion import SnapshotAssertion

from tests.fixtures.client import ClientSpawner
from virtool.fake.next import DataFaker
from virtool.models.enums import Permission


@pytest.mark.parametrize("find", [None, "fred"])
async def test_find(
    find: str | None,
    fake: DataFaker,
    snapshot_recent: SnapshotAssertion,
    spawn_client: ClientSpawner,
):
    """Test that a ``GET /users`` returns a list of users."""
    client = await spawn_client(
        administrator=True,
        authenticated=True,
        permissions=[Permission.create_sample],
    )

    await fake.users.create(handle=find)
    await fake.users.create()

    url = "/users"

    if find:
        url += f"?find={find}"

    resp = await client.get(url)

    assert resp.status == HTTPStatus.OK
    assert await resp.json() == snapshot_recent
