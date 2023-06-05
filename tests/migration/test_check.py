import pytest
from sqlalchemy.ext.asyncio import AsyncSession, AsyncEngine

from virtool.migration.check import check_data_revision_version
from virtool.migration.model import SQLRevision
from virtool.utils import timestamp


@pytest.mark.parametrize("revision", ["test_2", "test_missing"])
async def test_check_data_revision_version(revision: str, mocker, pg: AsyncEngine):
    mocker.patch("virtool.migration.check.REQUIRED_VIRTOOL_REVISION", revision)

    async with AsyncSession(pg) as session:
        for suffix in (1, 2, 3):
            session.add(
                SQLRevision(
                    name=f"Test {suffix}",
                    revision=f"test_{suffix}",
                    created_at=timestamp(),
                    applied_at=timestamp(),
                )
            )

        await session.commit()

    if revision == "test_2":
        await check_data_revision_version(pg)

    if revision == "test_missing":
        with pytest.raises(SystemExit) as exc:
            await check_data_revision_version(pg)

        assert exc.value.code == 1
