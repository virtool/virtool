from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from virtool.blast.models import SQLNuVsBlast


async def get_nuvs_blast(
    session: AsyncSession, analysis_id: str, sequence_index: int
) -> SQLNuVsBlast:
    result = await session.scalar(
        select(SQLNuVsBlast)
        .where(SQLNuVsBlast.analysis_id == analysis_id)
        .where(SQLNuVsBlast.sequence_index == sequence_index)
    )

    return result


async def delete_nuvs_blast(
    session: AsyncSession, analysis_id: str, sequence_index: int
) -> int:
    result = await session.execute(
        delete(SQLNuVsBlast)
        .where(SQLNuVsBlast.analysis_id == analysis_id)
        .where(SQLNuVsBlast.sequence_index == sequence_index)
    )

    await session.commit()

    return result.rowcount
