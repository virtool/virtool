import pytest

from virtool.auth.models import ResourceType


@pytest.mark.apitest
@pytest.mark.parametrize(
    "resource,status",
    [(ResourceType.app, 200), (ResourceType.group, 200), ("invalid", 400), (None, 200)],
)
async def test_find(spawn_client, resource, status, pg, snapshot):
    client = await spawn_client(authorize=True)

    url = "/source/permissions"

    if resource:
        url += f"?resource_type={resource}"

    resp = await client.get(url)

    assert resp.status == status
    assert await resp.json() == snapshot
