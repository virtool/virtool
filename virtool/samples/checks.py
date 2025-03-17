from motor.motor_asyncio import AsyncIOMotorClientSession

from virtool.data.errors import ResourceConflictError
from virtool.mongo.utils import check_missing_ids
from virtool.samples.utils import check_labels


async def check_name_is_in_use(
    mongo,
    name: str,
    sample_id: str | None = None,
    session: AsyncIOMotorClientSession | None = None,
):
    query = {"name": name}

    if sample_id:
        query["_id"] = {"$ne": sample_id}

    if await mongo.samples.count_documents(query, limit=1, session=session) != 0:
        raise ResourceConflictError("Sample name is already in use")


async def check_subtractions_do_not_exist(
    db,
    subtractions: list[str],
    session: AsyncIOMotorClientSession | None = None,
):
    if non_existent_subtractions := await check_missing_ids(
        db.subtraction,
        subtractions,
        session=session,
    ):
        raise ResourceConflictError(
            f"Subtractions do not exist: {','.join(non_existent_subtractions)}",
        )


async def check_labels_do_not_exist(pg, labels: list[int]):
    if labels and (non_existent_labels := await check_labels(pg, labels)):
        raise ResourceConflictError(f"Labels do not exist: {non_existent_labels}")
