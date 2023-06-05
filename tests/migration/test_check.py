from sqlalchemy.ext.asyncio import AsyncEngine

from virtool.migration.check import check_data_revision_version
from virtool.migration.model import SQLRevision
from virtool.utils import timestamp


async def test_check_data_revision_version(mocker, pg: AsyncEngine, spawn_client):
    mocker.patch("virtool.migration.check.REQUIRED_VIRTOOL_REVISION", "test_1")

    async with AsyncEngine(pg) as session:
        session.add(
            SQLRevision(
                name="Test 1",
                revision="test_1",
                created_at=timestamp(),
                applied_at=timestamp(),
            )
        )
        await session.commit()

    try:
        await check_data_revision_version(pg)
    except SystemExit as e:
        assert e.code == 1
