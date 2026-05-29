"""Tests for the strip-imported_from-to-upload-id migration."""

import asyncio
from collections.abc import Callable

import arrow
import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from assets.revisions.rev_lut29ur1nc8w_strip_imported_from_to_upload_id import upgrade
from virtool.migration.ctx import MigrationContext


@pytest.fixture
async def upload(
    ctx: MigrationContext,
    apply_alembic: Callable,
) -> dict:
    """Apply alembic head and seed one user and one upload.

    Returns the upload's ``id`` and ``name_on_disk``.
    """
    await asyncio.to_thread(apply_alembic, "head")

    async with AsyncSession(ctx.pg) as session:
        result = await session.execute(
            text("""
                INSERT INTO users (
                    handle, active, email, force_reset, invalidate_sessions,
                    last_password_change, password, settings
                )
                VALUES ('uploader', true, '', false, false, :now, :pw, '{}'::jsonb)
                RETURNING id
            """),
            {"now": arrow.utcnow().naive, "pw": b"hashed"},
        )
        user_id = result.scalar_one()

        result = await session.execute(
            text("""
                INSERT INTO uploads (
                    name, name_on_disk, ready, removed, reserved, user_id
                )
                VALUES (
                    'reference.json.gz', 'knoqfdk9-reference.json.gz',
                    true, false, true, :user_id
                )
                RETURNING id, name_on_disk
            """),
            {"user_id": user_id},
        )
        row = result.one()

        await session.commit()

    return {"id": row.id, "name_on_disk": row.name_on_disk}


async def test_legacy_name_on_disk_resolves(ctx: MigrationContext, upload: dict):
    """A legacy ``name_on_disk`` string id is stripped to the integer upload id."""
    await ctx.mongo.references.insert_one(
        {
            "_id": "legacy",
            "imported_from": {
                "name": "reference.json.gz",
                "user": {"id": "igboyes"},
                "id": upload["name_on_disk"],
            },
        },
    )

    await upgrade(ctx)

    doc = await ctx.mongo.references.find_one({"_id": "legacy"})
    assert doc["imported_from"] == {"id": upload["id"]}


async def test_int_id_is_stripped(ctx: MigrationContext, upload: dict):
    """An integer id with extra frozen fields is reduced to just the id."""
    await ctx.mongo.references.insert_one(
        {
            "_id": "frozen",
            "imported_from": {
                "id": upload["id"],
                "name": "reference.json.gz",
                "user": {"id": 5},
            },
        },
    )

    await upgrade(ctx)

    doc = await ctx.mongo.references.find_one({"_id": "frozen"})
    assert doc["imported_from"] == {"id": upload["id"]}


async def test_digit_string_coerces(ctx: MigrationContext, upload: dict):
    """A numeric string id is coerced to an integer."""
    await ctx.mongo.references.insert_one(
        {"_id": "digit", "imported_from": {"id": str(upload["id"])}},
    )

    await upgrade(ctx)

    doc = await ctx.mongo.references.find_one({"_id": "digit"})
    assert doc["imported_from"] == {"id": upload["id"]}


@pytest.mark.usefixtures("upload")
async def test_unresolvable_upload_is_cleared(ctx: MigrationContext):
    """A reference pointing at a deleted upload has imported_from cleared."""
    await ctx.mongo.references.insert_one(
        {
            "_id": "dangling",
            "imported_from": {"id": "gone-reference.json.gz"},
        },
    )

    await upgrade(ctx)

    doc = await ctx.mongo.references.find_one({"_id": "dangling"})
    assert doc["imported_from"] is None


@pytest.mark.usefixtures("upload")
async def test_reference_without_imported_from_untouched(ctx: MigrationContext):
    """A reference with no imported_from field is left alone."""
    await ctx.mongo.references.insert_one({"_id": "plain", "name": "Plain"})

    await upgrade(ctx)

    doc = await ctx.mongo.references.find_one({"_id": "plain"})
    assert "imported_from" not in doc


async def test_second_run_is_noop(ctx: MigrationContext, upload: dict):
    """Re-running the migration does not change already-stripped documents."""
    await ctx.mongo.references.insert_one(
        {
            "_id": "legacy",
            "imported_from": {"id": upload["name_on_disk"]},
        },
    )

    await upgrade(ctx)
    await upgrade(ctx)

    doc = await ctx.mongo.references.find_one({"_id": "legacy"})
    assert doc["imported_from"] == {"id": upload["id"]}
