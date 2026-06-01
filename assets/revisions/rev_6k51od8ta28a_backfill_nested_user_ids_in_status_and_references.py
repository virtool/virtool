"""Backfill nested MongoDB user.id fields to integers.

The earlier ``ie7r3vdaf5mu`` backfill only rewrote top-level ``user.id`` fields.
It missed the nested ``user`` subdocuments written by
``create_update_subdocument``: ``installed.user.id`` and every
``updates[].user.id`` in the ``status`` collection's ``hmm`` document and in
``references`` documents. Those still hold legacy string user ids, which crash
the user transform.

This rewrites those nested legacy string user ids to the matching
``SQLUser.id`` integer.

Idempotent: integer ids are passed through unchanged, so a second run is a
no-op.

Revision ID: 6k51od8ta28a
Date: 2026-06-01 18:26:22.669463

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
name = "backfill nested user ids in status and references"
created_at = arrow.get("2026-06-01 18:26:22.669463")
revision_id = "6k51od8ta28a"

alembic_down_revision = None
virtool_down_revision = "31su1xw351h2"

# Change this if an Alembic revision is required to run this migration.
required_alembic_revision = None


async def upgrade(ctx: MigrationContext) -> None:
    async with AsyncSession(ctx.pg) as pg_session:
        user_result = await pg_session.execute(
            text("SELECT id, legacy_id FROM users WHERE legacy_id IS NOT NULL"),
        )
        user_map: dict[str, int] = {row.legacy_id: row.id for row in user_result}

    logger.info("built user id map", users=len(user_map))

    await _backfill_nested_user_ids(ctx.mongo, "status", user_map)
    await _backfill_nested_user_ids(ctx.mongo, "references", user_map)


def _coerce_user_id(value: int | str, user_map: dict[str, int]) -> int:
    if isinstance(value, int):
        return value

    if value in user_map:
        return user_map[value]

    if isinstance(value, str) and value.isdigit():
        return int(value)

    msg = f"User legacy id {value!r} not found in postgres"
    raise ValueError(msg)


def _coerce_nested_user_id(
    user: dict | None,
    user_map: dict[str, int],
) -> tuple[dict | None, bool]:
    """Coerce ``user.id`` on a single subdocument's ``user`` field.

    Returns the (possibly rewritten) ``user`` value and whether it changed.
    """
    if not user or "id" not in user:
        return user, False

    current = user["id"]
    new = _coerce_user_id(current, user_map)

    if isinstance(current, int) and new == current:
        return user, False

    return {**user, "id": new}, True


async def _backfill_nested_user_ids(
    mongo: "AsyncIOMotorDatabase",
    collection_name: str,
    user_map: dict[str, int],
) -> None:
    collection = mongo[collection_name]

    migrated = 0
    unchanged = 0
    skipped = 0

    async for doc in collection.find(
        {},
        projection={"installed": 1, "updates": 1},
    ):
        installed = doc.get("installed")
        updates = doc.get("updates")

        has_installed_user = bool(installed and "user" in installed)
        has_updates = bool(updates)

        if not has_installed_user and not has_updates:
            skipped += 1
            continue

        update: dict = {}

        if has_installed_user:
            new_user, changed = _coerce_nested_user_id(installed["user"], user_map)
            if changed:
                update["installed.user"] = new_user

        if has_updates:
            new_updates = []
            updates_changed = False

            for entry in updates:
                new_user, changed = _coerce_nested_user_id(
                    entry.get("user"),
                    user_map,
                )
                if changed:
                    updates_changed = True
                    new_updates.append({**entry, "user": new_user})
                else:
                    new_updates.append(entry)

            if updates_changed:
                update["updates"] = new_updates

        if not update:
            unchanged += 1
            continue

        await collection.update_one({"_id": doc["_id"]}, {"$set": update})
        migrated += 1

    logger.info(
        "backfilled nested user.id",
        collection=collection_name,
        migrated=migrated,
        unchanged=unchanged,
        skipped=skipped,
    )
