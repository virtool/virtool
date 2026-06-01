"""Backfill ``subtraction`` user ids to integers.

The ``ie7r3vdaf5mu`` and ``nmqvw9wu298b`` backfills both targeted a collection
named ``subtractions`` (plural), which does not exist -- the real collection is
``subtraction`` (singular). As a result the subtraction documents were never
rewritten and still carry legacy string ``user.id`` values that crash the user
transform at runtime.

Both earlier revisions have been corrected, but they are already recorded as
applied on existing environments and cannot be re-run under their own ids. This
revision rewrites the legacy string ``user.id`` values in the ``subtraction``
collection to the matching ``SQLUser.id`` integer so those environments
converge.

Idempotent: integer ids are passed through unchanged, so this is a no-op on
environments that were already backfilled.

Revision ID: x602yxtuaeg5
Date: 2026-06-01 22:39:31.802777

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
name = "backfill subtraction user ids"
created_at = arrow.get("2026-06-01 22:39:31.802777")
revision_id = "x602yxtuaeg5"

alembic_down_revision = None
virtool_down_revision = "nmqvw9wu298b"

# Change this if an Alembic revision is required to run this migration.
required_alembic_revision = None


async def upgrade(ctx: MigrationContext) -> None:
    async with AsyncSession(ctx.pg) as pg_session:
        user_result = await pg_session.execute(
            text("SELECT id, legacy_id FROM users WHERE legacy_id IS NOT NULL"),
        )
        user_map: dict[str, int] = {row.legacy_id: row.id for row in user_result}

    logger.info("built id map", users=len(user_map))

    await _backfill_user_field(ctx.mongo, user_map)


def _coerce_user_id(value: int | str, user_map: dict[str, int]) -> int:
    if isinstance(value, int):
        return value

    if value in user_map:
        return user_map[value]

    msg = f"User legacy id {value!r} not found in postgres"
    raise ValueError(msg)


async def _backfill_user_field(
    mongo: "AsyncIOMotorDatabase",
    user_map: dict[str, int],
) -> None:
    collection = mongo["subtraction"]

    migrated = 0
    unchanged = 0
    skipped = 0

    async for doc in collection.find(
        {"user.id": {"$type": "string"}},
        projection={"user": 1},
    ):
        user = doc.get("user")
        if not user or "id" not in user:
            skipped += 1
            continue

        current = user["id"]
        new = _coerce_user_id(current, user_map)

        if new == current and isinstance(current, int):
            unchanged += 1
            continue

        await collection.update_one(
            {"_id": doc["_id"]},
            {"$set": {"user.id": new}},
        )
        migrated += 1

    logger.info(
        "backfilled user.id",
        collection="subtraction",
        migrated=migrated,
        unchanged=unchanged,
        skipped=skipped,
    )
