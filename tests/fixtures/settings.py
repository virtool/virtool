import pytest
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.settings.sql import SQLSettings


@pytest.fixture
async def test_settings(pg: AsyncEngine):
    async with AsyncSession(pg) as session:
        await session.merge(
            SQLSettings(
                id=1,
                default_source_types=["isolate", "strain"],
                enable_api=True,
                enable_sentry=True,
                minimum_password_length=8,
                sample_all_read=True,
                sample_all_write=False,
                sample_group="none",
                sample_group_read=True,
                sample_group_write=False,
            ),
        )
        await session.commit()
