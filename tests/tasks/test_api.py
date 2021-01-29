import pytest

from virtool.tasks.models import Task


async def test_find(spawn_client, pg_session, snapshot, static_time):
    """
    Test that a ``GET /api/tasks`` return a complete list of tasks.

    """
    client = await spawn_client(authorize=True, administrator=True)

    task_1 = Task(
        id=1,
        complete=True,
        context={
            "user_id": "test_1"
        },
        count=40,
        created_at=static_time.datetime,
        file_size=1024,
        progress=100,
        step="download",
        type="clone_reference"
    )
    task_2 = Task(
        id=2,
        complete=False,
        context={
            "user_id": "test_2"
        },
        count=30,
        created_at=static_time.datetime,
        file_size=14754,
        progress=80,
        step="download",
        type="import_reference"
    )

    async with pg_session as session:
        session.add_all([task_1, task_2])
        await session.commit()

    resp = await client.get("/api/tasks")
    assert resp.status == 200

    snapshot.assert_match(await resp.json())


@pytest.mark.parametrize("error", [None, "404"])
async def test_get(error, spawn_client, all_permissions, pg_session, static_time, resp_is):
    """
    Test that a ``GET /api/tasks/:task_id`` return the correct task document.

    """
    client = await spawn_client(authorize=True, administrator=True)

    if not error:
        task = Task(
            id=1,
            complete=True,
            context={
                "user_id": "test_1"
            },
            count=40,
            created_at=static_time.datetime,
            file_size=1024,
            progress=100,
            step="download",
            type="clone_reference"
        )
        async with pg_session as session:
            session.add(task)
            await session.commit()

    resp = await client.get("/api/tasks/1")

    if error:
        assert await resp_is.not_found(resp)
        return

    assert resp.status == 200

    assert await resp.json() == {
        'complete': True,
        'context': {
            'user_id': 'test_1'
        },
        'count': 40,
        'created_at': '2015-10-06T20:00:00Z',
        'file_size': 1024,
        'id': 1,
        'progress': 100,
        'step': 'download',
        'type': 'clone_reference'
    }
