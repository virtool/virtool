import pytest
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from virtool.tasks.models import Task
from virtool.users.tasks import UpdateUserDocumentsTask


@pytest.mark.parametrize("user", ["ad_user", "existing_user", "user_with_handle"])
async def test_update_user_document_task(
    spawn_client, snapshot, pg: AsyncEngine, static_time, mocker, user
):
    client = await spawn_client()

    if user == "ad_user":
        document = {"_id": "abc123", "b2c_given_name": "foo", "b2c_family_name": "bar"}

    elif user == "existing_user":
        document = {"_id": "abc123"}

    else:
        document = {"_id": "abc123", "handle": "bar"}

    await client.db.users.insert_one(document)

    mocker.patch("virtool.users.db.generate_handle", return_value="foo")

    async with AsyncSession(pg) as session:
        session.add(
            Task(
                id=1,
                context={},
                count=0,
                progress=0,
                step="rename_index_files",
                type="add_subtraction_files",
                created_at=static_time.datetime,
            )
        )
        await session.commit()

    add_index_files_task = UpdateUserDocumentsTask(client.app, 1)
    await add_index_files_task.run()

    assert await client.db.users.find_one({"_id": "abc123"}) == snapshot
