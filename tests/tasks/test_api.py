import pytest
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from tests.fixtures.client import ClientSpawner
from virtool.tasks.models import SQLTask


async def test_find(spawn_client, pg: AsyncEngine, snapshot, static_time):
    """Test that a ``GET /tasks`` return a complete list of tasks."""
    client = await spawn_client(authenticated=True)

    async with AsyncSession(pg) as session:
        session.add_all(
            [
                SQLTask(
                    id=1,
                    complete=True,
                    context={"user_id": "test_1"},
                    count=40,
                    created_at=static_time.datetime,
                    file_size=1024,
                    progress=100,
                    step="download",
                    type="clone_reference",
                ),
                SQLTask(
                    id=2,
                    complete=False,
                    context={"user_id": "test_2"},
                    count=30,
                    created_at=static_time.datetime,
                    file_size=14754,
                    progress=80,
                    step="download",
                    type="import_reference",
                ),
            ],
        )
        await session.commit()

    resp = await client.get("/tasks")

    assert resp.status == 200
    assert await resp.json() == snapshot


@pytest.mark.parametrize("error", [None, "404"])
async def test_get(
    error: str | None,
    pg: AsyncEngine,
    resp_is,
    spawn_client: ClientSpawner,
    snapshot,
    static_time,
):
    """Test that a ``GET /tasks/:task_id`` return the correct task document."""
    client = await spawn_client(authenticated=True)

    if not error:
        async with AsyncSession(pg) as session:
            session.add(
                SQLTask(
                    id=1,
                    complete=True,
                    context={"user_id": "test_1"},
                    count=40,
                    created_at=static_time.datetime,
                    file_size=1024,
                    progress=100,
                    step="download",
                    type="clone_reference",
                ),
            )
            await session.commit()

    resp = await client.get("/tasks/1")

    if error:
        await resp_is.not_found(resp)
    else:
        assert resp.status == 200
        assert await resp.json() == snapshot
