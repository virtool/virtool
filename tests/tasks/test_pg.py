import virtool.tasks.pg
from virtool.tasks.models import Task


async def test_find(snapshot, spawn_client, pg, pg_session, static_time):
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

    assert await virtool.tasks.pg.find(pg) == snapshot


async def test_get(snapshot, spawn_client, pg, pg_session, static_time):
    async with pg_session as session:
        session.add(Task(
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
        ))
        await session.commit()

    assert await virtool.tasks.pg.get(pg, 1) == snapshot
