"""Convert ``samples.group`` to an integer id or ``None``.

Groups are now Postgres-only with an integer ``id`` and a permanent
``legacy_id`` (the old Mongo string id). The ``samples.group`` field stays in
Mongo but must hold an integer ``groups.id`` value, or ``None`` when the sample
has no owner group.

Historically the field also used the string sentinel ``"none"`` to mean "no
owner group". This revision normalizes that sentinel to ``None``, resolves
legacy string ids to their integer ``groups.id`` via ``groups.legacy_id``, and
passes already-integer values through unchanged, so the revision is idempotent
and safe to re-run.

Unresolved string ids raise loudly rather than being dropped or stored as
``None`` -- a sample referencing a group that no longer exists in Postgres is a
data-integrity problem that must surface, not be silently swallowed.

Revision ID: bfzcj3gxn2dd
Date: 2026-07-03 21:24:58.102815

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
name = "backfill samples group ids to integers"
created_at = arrow.get("2026-07-03 21:24:58.102815")
revision_id = "bfzcj3gxn2dd"

alembic_down_revision = "a73a2668403f"
virtool_down_revision = None

# Change this if an Alembic revision is required to run this migration.
required_alembic_revision = None


async def upgrade(ctx: MigrationContext) -> None:
    async with AsyncSession(ctx.pg) as pg_session:
        result = await pg_session.execute(
            text("SELECT id, legacy_id FROM groups WHERE legacy_id IS NOT NULL"),
        )
        group_map: dict[str, int] = {row.legacy_id: row.id for row in result}

    logger.info("built id map", groups=len(group_map))

    await _backfill_sample_groups(ctx.mongo, group_map)


def _coerce_group_id(value: int | str, group_map: dict[str, int]) -> int | None:
    if value == "none":
        return None

    if value in group_map:
        return group_map[value]

    msg = f"Group legacy id {value!r} not found in postgres"
    raise ValueError(msg)


async def _backfill_sample_groups(
    mongo: "AsyncIOMotorDatabase",
    group_map: dict[str, int],
) -> None:
    collection = mongo["samples"]

    migrated = 0

    async for doc in collection.find(
        {"group": {"$type": "string"}},
        projection={"group": 1},
    ):
        await collection.update_one(
            {"_id": doc["_id"]},
            {"$set": {"group": _coerce_group_id(doc["group"], group_map)}},
        )
        migrated += 1

    logger.info(
        "backfilled group ids",
        collection="samples",
        migrated=migrated,
    )
