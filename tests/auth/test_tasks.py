import asyncio

from sqlalchemy.ext.asyncio import AsyncSession
from virtool_core.models.enums import Permission

from virtool.auth.openfga import list_group_permissions
from virtool.auth.tasks import SyncPermissionsTask
from virtool.auth.utils import write_tuple
from virtool.tasks.models import Task
from virtool.utils import get_temp_dir


async def test_sync(delete_store, data_layer, snapshot, fake2, pg, static_time):
    group = await fake2.groups.create(
        permissions={
            Permission.create_sample: True,
            Permission.modify_subtraction: True,
        }
    )

    group2 = await fake2.groups.create(permissions={Permission.cancel_job: True})

    async with AsyncSession(pg) as session:
        session.add(
            Task(
                id=1,
                complete=False,
                context={},
                count=0,
                progress=0,
                step="sync",
                type="sync_task",
                created_at=static_time.datetime,
            )
        )
        await session.commit()

    task = SyncPermissionsTask(1, data_layer, {}, get_temp_dir())

    await task.run()

    await asyncio.gather(
        write_tuple(
            data_layer.auth._auth_client.open_fga,
            "user",
            "ryanf",
            ["member"],
            "group",
            group.id,
        ),
        write_tuple(
            data_layer.auth._auth_client.open_fga,
            "user",
            "ryanf",
            ["member"],
            "group",
            group2.id,
        ),
    )

    assert (
        await data_layer.auth._auth_client.list_permissions("ryanf", "app", "virtool")
        == snapshot
    )
