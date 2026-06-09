"""Convert ``samples.subtractions`` array elements to integer ids.

Subtractions are now Postgres-only with an integer ``id`` and a permanent
``legacy_id`` (the old Mongo string id). The ``samples.subtractions`` array
stays in Mongo but must hold integer ``subtractions.id`` values rather than
legacy string ids.

This revision rewrites each element of every sample's ``subtractions`` array,
resolving legacy string ids to their integer ``subtractions.id`` via
``subtractions.legacy_id``. Already-integer elements pass through unchanged, so
the revision is idempotent and safe to re-run.

Unresolved string ids raise loudly rather than being dropped or stored as
``NULL`` -- a sample referencing a subtraction that no longer exists in Postgres
is a data-integrity problem that must surface, not be silently swallowed.

Revision ID: 24ysb9cwjiv1
Date: 2026-06-09 16:14:05.797921

"""

from typing import TYPE_CHECKING

import arrow
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from structlog import get_logger

from virtool.migration import MigrationContext

if TYPE_CHECKING:
    from motor.motor_asyncio import AsyncIOMotorDatabase

logger = get_logger("migration")

# Revision identifiers.
name = "backfill samples subtractions to integers"
created_at = arrow.get("2026-06-09 16:14:05.797921")
revision_id = "24ysb9cwjiv1"

alembic_down_revision = "869aa923399e"
virtool_down_revision = None

# Change this if an Alembic revision is required to run this migration.
required_alembic_revision = None


async def upgrade(ctx: MigrationContext) -> None:
    async with AsyncSession(ctx.pg) as pg_session:
        result = await pg_session.execute(
            text("SELECT id, legacy_id FROM subtractions WHERE legacy_id IS NOT NULL"),
        )
        subtraction_map: dict[str, int] = {row.legacy_id: row.id for row in result}

    logger.info("built id map", subtractions=len(subtraction_map))

    await _backfill_sample_subtractions(ctx.mongo, subtraction_map)


def _coerce_subtraction_id(value: int | str, subtraction_map: dict[str, int]) -> int:
    if isinstance(value, int):
        return value

    if value in subtraction_map:
        return subtraction_map[value]

    msg = f"Subtraction legacy id {value!r} not found in postgres"
    raise ValueError(msg)


async def _backfill_sample_subtractions(
    mongo: "AsyncIOMotorDatabase",
    subtraction_map: dict[str, int],
) -> None:
    collection = mongo["samples"]

    migrated = 0

    async for doc in collection.find(
        {"subtractions": {"$type": "string"}},
        projection={"subtractions": 1},
    ):
        subtractions = [
            _coerce_subtraction_id(value, subtraction_map)
            for value in doc["subtractions"]
        ]

        await collection.update_one(
            {"_id": doc["_id"]},
            {"$set": {"subtractions": subtractions}},
        )
        migrated += 1

    logger.info(
        "backfilled subtractions",
        collection="samples",
        migrated=migrated,
    )
