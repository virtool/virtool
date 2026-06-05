"""Shared helpers for upload tests."""

from datetime import timedelta

from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.uploads.sql import SQLUpload
from virtool.utils import timestamp


async def backdate_upload(pg: AsyncEngine, upload_id: int, age: timedelta) -> None:
    """Set an upload's ``created_at`` to ``age`` in the past."""
    async with AsyncSession(pg) as session:
        await session.execute(
            update(SQLUpload)
            .where(SQLUpload.id == upload_id)
            .values(created_at=timestamp() - age),
        )
        await session.commit()
