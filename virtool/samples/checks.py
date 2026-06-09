from motor.motor_asyncio import AsyncIOMotorClientSession
from sqlalchemy.ext.asyncio import AsyncEngine

from virtool.data.errors import ResourceConflictError
from virtool.samples.utils import check_labels
from virtool.subtractions.db import get_missing_subtraction_ids


async def check_name_is_in_use(
    mongo,
    name: str,
    sample_id: str | None = None,
    session: AsyncIOMotorClientSession | None = None,
) -> None:
    query = {"name": name}

    if sample_id:
        query["_id"] = {"$ne": sample_id}

    if await mongo.samples.count_documents(query, limit=1, session=session) != 0:
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
