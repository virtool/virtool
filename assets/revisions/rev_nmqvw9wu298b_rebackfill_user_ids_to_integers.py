"""Re-backfill MongoDB user and group ids to integers.

A repeat of the ``ie7r3vdaf5mu`` backfill. That revision was recorded as applied
on environments where the Mongo data was never actually rewritten (it was skipped
by the old position-based apply logic), leaving legacy string ``user.id`` values
in collections like ``subtraction`` that crash the user transform.

Because ``ie7r3vdaf5mu`` is already recorded as applied, it cannot be re-run under
its own id. This new revision re-runs the same backfill so those environments
converge.

Rewrites legacy string user ids to the matching ``SQLUser.id`` integer in every
Mongo collection that carries a denormalized top-level ``user.id``, the
``references`` ``users`` array, and the legacy group id strings in the ``groups``
array of the ``users`` collection.

Idempotent: integer ids are passed through unchanged, so this is a no-op on
environments that were already backfilled.

Revision ID: nmqvw9wu298b
Date: 2026-06-01 19:33:57.580352

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
name = "re-backfill user ids to integers"
created_at = arrow.get("2026-06-01 19:33:57.580352")
revision_id = "nmqvw9wu298b"

alembic_down_revision = None
virtool_down_revision = "6k51od8ta28a"

# Change this if an Alembic revision is required to run this migration.
required_alembic_revision = None


SIMPLE_USER_COLLECTIONS = (
    "keys",
    "samples",
    "subtraction",
    "analyses",
    "otus",
    "history",
    "indexes",
)


async def upgrade(ctx: MigrationContext) -> None:
    async with AsyncSession(ctx.pg) as pg_session:
        user_result = await pg_session.execute(
            text("SELECT id, legacy_id FROM users WHERE legacy_id IS NOT NULL"),
        )
        user_map: dict[str, int] = {row.legacy_id: row.id for row in user_result}

        group_result = await pg_session.execute(
            text("SELECT id, legacy_id FROM groups WHERE legacy_id IS NOT NULL"),
        )
        group_map: dict[str, int] = {row.legacy_id: row.id for row in group_result}

    logger.info(
        "built id maps",
        users=len(user_map),
        groups=len(group_map),
    )

    for collection_name in SIMPLE_USER_COLLECTIONS:
        await _backfill_user_field(ctx.mongo, collection_name, user_map)

    await _backfill_references(ctx.mongo, user_map)
    await _backfill_users_groups(ctx.mongo, group_map)


def _coerce_id(value: int | str, id_map: dict[str, int], resource_name: str) -> int:
    if isinstance(value, int):
        return value

    if value in id_map:
        return id_map[value]

    msg = f"{resource_name} legacy id {value!r} not found in postgres"
    raise ValueError(msg)


def _coerce_user_id(value: int | str, user_map: dict[str, int]) -> int:
    return _coerce_id(value, user_map, "User")


def _coerce_group_id(value: int | str, group_map: dict[str, int]) -> int:
    return _coerce_id(value, group_map, "Group")


async def _backfill_user_field(
    mongo: "AsyncIOMotorDatabase",
    collection_name: str,
    user_map: dict[str, int],
) -> None:
    collection = mongo[collection_name]

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
        collection=collection_name,
        migrated=migrated,
        unchanged=unchanged,
        skipped=skipped,
    )


async def _backfill_references(
    mongo: "AsyncIOMotorDatabase",
    user_map: dict[str, int],
) -> None:
    collection = mongo["references"]

    migrated = 0
    unchanged = 0
    skipped = 0

    async for doc in collection.find(
        {"$or": [{"user.id": {"$type": "string"}}, {"users.id": {"$type": "string"}}]},
        projection={"user": 1, "users": 1},
    ):
        update: dict = {}

        user = doc.get("user")
        users_list = doc.get("users")

        if not (user and "id" in user) and users_list is None:
            skipped += 1
            continue

        if user and "id" in user:
            current = user["id"]
            new = _coerce_user_id(current, user_map)
            if not (isinstance(current, int) and new == current):
                update["user.id"] = new

        users = users_list or []
        new_users = []
        users_changed = False

        for entry in users:
            if "id" not in entry:
                new_users.append(entry)
                continue
            current = entry["id"]
            new = _coerce_user_id(current, user_map)
            if not (isinstance(current, int) and new == current):
                users_changed = True
            new_entry = {**entry, "id": new}
            new_users.append(new_entry)

        if users_changed:
            update["users"] = new_users

        if not update:
            unchanged += 1
            continue

        await collection.update_one({"_id": doc["_id"]}, {"$set": update})
        migrated += 1

    logger.info(
        "backfilled references",
        migrated=migrated,
        unchanged=unchanged,
        skipped=skipped,
    )


async def _backfill_users_groups(
    mongo: "AsyncIOMotorDatabase",
    group_map: dict[str, int],
) -> None:
    collection = mongo["users"]

    migrated = 0
    unchanged = 0
    skipped = 0

    async for doc in collection.find(
        {"groups": {"$type": "string"}},
        projection={"groups": 1},
    ):
        groups = doc.get("groups")
        if groups is None:
            skipped += 1
            continue

        new_groups = [_coerce_group_id(g, group_map) for g in groups]

        if new_groups == groups and all(isinstance(g, int) for g in groups):
            unchanged += 1
            continue

        await collection.update_one(
            {"_id": doc["_id"]},
            {"$set": {"groups": new_groups}},
        )
        migrated += 1

    logger.info(
        "backfilled users.groups",
        migrated=migrated,
        unchanged=unchanged,
        skipped=skipped,
    )
