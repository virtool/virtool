import os
from pathlib import Path

import pytest
import virtool.tasks.pg
import virtool.tasks.task
from sqlalchemy import select
from virtool.tasks.models import Task


class DummyTask(virtool.tasks.task.Task):
    def __init__(self, app, task_id):
        super().__init__(app, task_id)

        self.steps = [self.create_file, self.remove_file]
        self.temp_path = Path(self.temp_dir.name)

    async def create_file(self):
        with open(self.temp_path / "test.txt", "w") as f:
            f.write("This is a test file.")

        await virtool.tasks.pg.update(self.pg, self.id, progress=50, step="create_file")

    async def remove_file(self):
        os.remove(self.temp_path / "test.txt")

        await virtool.tasks.pg.update(
            self.pg, self.id, progress=100, step="remove_file"
        )


@pytest.fixture()
async def task(spawn_client, pg_session, static_time):
    client = await spawn_client(authorize=True)
    task = Task(
        id=1,
        complete=False,
        context={"user_id": "test"},
        count=0,
        created_at=static_time.datetime,
        progress=0,
        step="create_file",
        type="test_task",
    )
    async with pg_session as session:
        session.add(task)
        await session.commit()

    return DummyTask(client.app, 1)


async def test_init_db(snapshot, task, static_time):
    await task.init_db()

    assert task.document == snapshot
    assert task.context == snapshot


@pytest.mark.parametrize("error", [None, "error"])
async def test_run(error, task, pg_session):
    task.errored = error
    await task.run()

    async with pg_session as session:
        result = (
            (await session.execute(select(Task).filter_by(id=task.id)))
            .scalar()
            .to_dict()
        )

    if error:
        assert result["progress"] == 0
    else:
        assert result["progress"] == 100
        assert not os.path.exists(task.temp_path)


async def test_update_context(task):
    context = await task.update_context({"ref_id": "askfllfk"})

    assert context == {"user_id": "test", "ref_id": "askfllfk"}


async def test_get_tracker(task, pg):
    task.step = task.steps[0]
    tracker_1 = await task.get_tracker()
    assert tracker_1.initial == 0
    assert tracker_1.step_completed == 50

    await virtool.tasks.pg.update(
        pg,
        task.id,
        progress=50,
    )

    task.step = task.steps[1]
    tracker_2 = await task.get_tracker()
    assert tracker_2.initial == 50
    assert tracker_2.step_completed == 100
