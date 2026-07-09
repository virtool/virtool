from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.data.errors import ResourceConflictError
from virtool.samples.sql import SQLLegacySample
from virtool.samples.utils import check_labels
from virtool.subtractions.db import get_missing_subtraction_ids


async def check_name_is_in_use(
    pg: AsyncEngine,
    name: str,
    sample_id: int | None = None,
) -> None:
    statement = select(SQLLegacySample.id).where(SQLLegacySample.name == name)

    if sample_id is not None:
        statement = statement.where(SQLLegacySample.id != sample_id)

    async with AsyncSession(pg) as session:
        if (await session.execute(statement.limit(1))).scalar_one_or_none() is not None:
            raise ResourceConflictError("Sample name is already in use")


async def check_subtractions_do_not_exist(
    pg: AsyncEngine, subtractions: list[int]
) -> None:
    if non_existent_subtractions := await get_missing_subtraction_ids(pg, subtractions):
        raise ResourceConflictError(
            f"Subtractions do not exist: "
            f"{','.join(str(s) for s in non_existent_subtractions)}"
        )


async def check_labels_do_not_exist(pg, labels: list[int]) -> None:
    if labels and (non_existent_labels := await check_labels(pg, labels)):
        raise ResourceConflictError(f"Labels do not exist: {non_existent_labels}")
