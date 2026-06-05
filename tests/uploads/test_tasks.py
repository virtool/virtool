from datetime import timedelta

from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from tests.uploads import backdate_upload
from virtool.data.layer import DataLayer
from virtool.fake.next import DataFaker
from virtool.pg.utils import get_row_by_id
from virtool.tasks.sql import SQLTask
from virtool.uploads.sql import SQLUpload
from virtool.uploads.tasks import ReapOrphanedUploadsTask
from virtool.utils import get_temp_dir, timestamp


async def test_reap_orphaned_uploads_task(
    data_layer: DataLayer,
    fake: DataFaker,
    pg: AsyncEngine,
):
    """The task deletes an old, reserved, unlinked upload when run."""
    orphan = await fake.uploads.create(user=await fake.users.create(), reserved=True)

    await backdate_upload(pg, orphan.id, timedelta(days=31))

    async with AsyncSession(pg) as session:
        session.add(
            SQLTask(
                id=1,
                complete=False,
                context={},
                count=0,
                progress=0,
                step="reap",
                type="reap_orphaned_uploads",
                created_at=timestamp(),
            ),
        )
        await session.commit()

    task = ReapOrphanedUploadsTask(1, data_layer, {}, get_temp_dir())

    await task.run()

    assert (await get_row_by_id(pg, SQLUpload, orphan.id)).removed is True
