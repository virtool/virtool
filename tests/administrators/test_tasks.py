from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.administrators.tasks import PromoteAdministratorsTask
from virtool.pg.utils import get_row_by_id
from virtool.tasks.models import Task
from virtool.utils import get_temp_dir


async def test_promote_administrators(
    data_layer,
    mongo,
    pg: AsyncEngine,
    snapshot,
    static_time,
    tmpdir,
    fake2,
):

    await fake2.users.create()

    user = await fake2.users.create()

    async with mongo.create_session() as session:
        await mongo.users.update_one(
            {"_id": user.id},
            {"$set": {"administrator": True}},
            session=session,
        )

    async with AsyncSession(pg) as session:
        session.add(
            Task(
                id=1,
                complete=False,
                count=0,
                progress=0,
                context={},
                step="promote_administrators",
                type="promote_administrators",
                created_at=static_time.datetime,
            )
        )
        await session.commit()

    task = PromoteAdministratorsTask(1, data_layer, {}, get_temp_dir())

    await task.run()

    row = await get_row_by_id(pg, Task, 1)
    assert row.complete is True

    assert (
        await data_layer.administrators._authorization_client.list_administrators()
        == [(user.id, "full")]
    )
