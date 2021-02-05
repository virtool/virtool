import pytest

import virtool.tasks.pg
from virtool.tasks.models import Task


async def test_find(spawn_client, pg_engine, pg_session, snapshot, static_time):
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

    results = await virtool.tasks.pg.find(pg_engine)

    assert results == [
    {
        'complete': True,
        'context': {
            'user_id': 'test_1'
        },
        'count': 40,
        'created_at': static_time.datetime,
        'error': None,
        'file_size': 1024,
        'id': 1,
        'progress': 100,
        'step': 'download',
        'type': 'clone_reference'
    },
    {
        'complete': False,
        'context': {
            'user_id': 'test_2'
        },
        'count': 30,
        'created_at': static_time.datetime,
        'error': None,
        'file_size': 14754,
        'id': 2,
        'progress': 80,
        'step': 'download',
        'type': 'import_reference'
    }
]


async def test_get(spawn_client, pg_engine, pg_session, static_time, snapshot):
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

    result = await virtool.tasks.pg.get(pg_engine, 1)
    assert result == {
        'complete': True,
        'context': {
            'user_id': 'test_1'
        },
        'count': 40,
        'created_at': static_time.datetime,
        'error': None,
        'file_size': 1024,
        'id': 1,
        'progress': 100,
        'step': 'download',
        'type': 'clone_reference'
    }
