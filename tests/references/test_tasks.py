import arrow
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from virtool.references.tasks import CleanReferencesTask
from virtool.tasks.models import Task


@pytest.mark.parametrize(
    "update",
    [
        None,
        {"name": "v1.2.0"},
        {"name": "v1.2.2", "ready": True},
        {
            "name": "v1.2.2",
            "created_at": arrow.get("2020-01-01T21:20:00").datetime,
            "ready": False,
        },
        {
            "name": "v1.2.2",
            "created_at": arrow.get("2020-01-01T21:00:00").datetime,
            "ready": False,
        },
    ],
    ids=["no_updates", "too_old", "ready", "too_new", "clean"],
)
async def test_clean_references_task(
    update, dbi, mocker, pg, snapshot, spawn_client, static_time
):
    """
    Test the following situations:

    * no updates have been applied to the references (`[]`)
    * the latest update is older than the installed version
    * the latest update is ready indicating the update was successful
    * the latest update subdocument was created recently and shouldn't be removed
    * the latest update subdocument is old and not ready (timed out)
    """
    mocker.patch("arrow.utcnow", return_value=arrow.get("2020-01-01T21:25:00"))

    client = await spawn_client(authorize=True)

    task = Task(
        id=1,
        complete=False,
        context={},
        count=0,
        progress=0,
        step="clean_timed_out_updates",
        type="clean_references",
        created_at=static_time.datetime,
    )

    async with AsyncSession(pg) as session:
        session.add(task)
        await session.commit()

    updates = []

    if update:
        updates.append(update)

    await dbi.references.insert_one(
        {
            "_id": "foo",
            "updates": updates,
            "installed": {"name": "v1.2.1"},
            "updating": True,
            "remotes_from": {"slug": "virtool/ref-plant-viruses"},
        }
    )

    clean_references_task = CleanReferencesTask(client.app, 1)
    await clean_references_task.run()

    assert await dbi.references.find_one({}) == snapshot
