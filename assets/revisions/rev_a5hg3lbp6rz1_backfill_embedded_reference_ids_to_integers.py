"""Convert the embedded ``reference.id`` in otus, sequences, and history to integers.

References now live in Postgres as ``legacy_references`` with an integer ``id``
and a permanent ``legacy_id`` (the old Mongo string id). The Mongo ``otus``,
``sequences``, and top-level ``history`` documents each embed a ``reference``
subdocument whose ``id`` must hold the integer ``legacy_references.id`` rather
than the legacy string.

This revision rewrites ``reference.id`` on every such document, resolving legacy
string ids to their integer ``legacy_references.id`` via
``legacy_references.legacy_id``. The ``{"reference.id": {"$type": "string"}}``
filter skips documents already holding an integer, so the revision is idempotent
and safe to re-run.

The ``legacy_history_diff`` stored on history documents is intentionally left
untouched -- ``patch_to_version`` overlays the authoritative reference onto a
reconstructed OTU at read time, so the reference embedded in the diff is
irrelevant.

Unresolved string ids raise loudly rather than being dropped or stored as
``NULL`` -- a document referencing a reference that no longer exists in Postgres
is a data-integrity problem that must surface, not be silently swallowed.

Revision ID: a5hg3lbp6rz1
Date: 2026-07-07 22:25:52.610486

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
name = "backfill embedded reference ids to integers"
created_at = arrow.get("2026-07-07 22:25:52.610486")
revision_id = "a5hg3lbp6rz1"

alembic_down_revision = "48aa4cef7b47"
virtool_down_revision = None

# Change this if an Alembic revision is required to run this migration.
required_alembic_revision = None

COLLECTIONS = ("otus", "sequences", "history")


async def upgrade(ctx: MigrationContext) -> None:
    async with AsyncSession(ctx.pg) as pg_session:
        result = await pg_session.execute(
            text(
                "SELECT id, legacy_id FROM legacy_references "
                "WHERE legacy_id IS NOT NULL",
            ),
        )
        reference_map: dict[str, int] = {row.legacy_id: row.id for row in result}

    logger.info("built id map", references=len(reference_map))

    for collection in COLLECTIONS:
        await _backfill_embedded_reference(ctx.mongo, collection, reference_map)


def _coerce_reference_id(value: int | str, reference_map: dict[str, int]) -> int:
    if isinstance(value, int):
        return value

    if value in reference_map:
        return reference_map[value]

    msg = f"Reference legacy id {value!r} not found in postgres"
    raise ValueError(msg)


async def _backfill_embedded_reference(
    mongo: "AsyncIOMotorDatabase",
    collection_name: str,
    reference_map: dict[str, int],
) -> None:
    collection = mongo[collection_name]

    migrated = 0

    async for doc in collection.find(
        {"reference.id": {"$type": "string"}},
        projection={"reference": 1},
    ):
        reference_id = _coerce_reference_id(doc["reference"]["id"], reference_map)

        await collection.update_one(
            {"_id": doc["_id"]},
            {"$set": {"reference.id": reference_id}},
        )
        migrated += 1

    logger.info(
        "backfilled embedded references",
        collection=collection_name,
        migrated=migrated,
    )
