"""Strip reference ``imported_from`` down to a single integer upload id.

Legacy references stored a frozen snapshot of the whole upload in
``imported_from``, including a denormalized ``user`` blob and a string ``id``
that was actually the upload's ``name_on_disk``. New code stores only
``{"id": <int>}`` and joins the live upload on fetch.

This revision rewrites every reference's ``imported_from`` to ``{"id": <int>}``:

* Integer ids are kept as-is.
* Numeric string ids are coerced to ``int``.
* Other string ids are treated as ``name_on_disk`` values and translated to the
  matching ``SQLUpload.id``.
* References whose upload no longer exists have ``imported_from`` set to
  ``None`` (the upload it pointed at is gone).

Idempotent: a document already shaped as ``{"id": <int>}`` is left untouched,
and cleared documents have a null ``imported_from`` that no longer matches the
query, so re-runs are no-ops.

Revision ID: lut29ur1nc8w
Date: 2026-05-29 18:26:49.748697

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
name = "strip imported_from to upload id"
created_at = arrow.get("2026-05-29 18:26:49.748697")
revision_id = "lut29ur1nc8w"

alembic_down_revision = None
virtool_down_revision = "q928h2q03qmp"

# Change this if an Alembic revision is required to run this migration.
required_alembic_revision = None


async def upgrade(ctx: MigrationContext) -> None:
    async with AsyncSession(ctx.pg) as pg_session:
        result = await pg_session.execute(
            text("SELECT id, name_on_disk FROM uploads"),
        )
        name_on_disk_map: dict[str, int] = {
            row.name_on_disk: row.id for row in result if row.name_on_disk is not None
        }

    logger.info("built upload name_on_disk map", uploads=len(name_on_disk_map))

    await _strip_imported_from(ctx.mongo, name_on_disk_map)


def _resolve_upload_id(
    value: int | str | None,
    name_on_disk_map: dict[str, int],
) -> int | None:
    """Resolve a stored ``imported_from`` id to the integer upload id.

    Returns ``None`` when the value cannot be resolved to an existing upload.
    """
    if isinstance(value, int):
        return value

    if isinstance(value, str):
        if value.isdigit():
            return int(value)

        return name_on_disk_map.get(value)

    return None


async def _strip_imported_from(
    mongo: "AsyncIOMotorDatabase",
    name_on_disk_map: dict[str, int],
) -> None:
    collection = mongo.references

    migrated = 0
    unchanged = 0
    cleared = 0

    async for doc in collection.find(
        {"imported_from": {"$ne": None}},
        projection={"imported_from": 1},
    ):
        imported_from = doc["imported_from"]

        if not isinstance(imported_from, dict):
            await collection.update_one(
                {"_id": doc["_id"]},
                {"$set": {"imported_from": None}},
            )
            cleared += 1
            continue

        upload_id = _resolve_upload_id(imported_from.get("id"), name_on_disk_map)

        if upload_id is None:
            logger.warning(
                "clearing imported_from with unresolvable upload",
                reference=doc["_id"],
                imported_from=imported_from,
            )
            await collection.update_one(
                {"_id": doc["_id"]},
                {"$set": {"imported_from": None}},
            )
            cleared += 1
            continue

        if imported_from == {"id": upload_id}:
            unchanged += 1
            continue

        await collection.update_one(
            {"_id": doc["_id"]},
            {"$set": {"imported_from": {"id": upload_id}}},
        )
        migrated += 1

    logger.info(
        "stripped imported_from",
        migrated=migrated,
        unchanged=unchanged,
        cleared=cleared,
    )
