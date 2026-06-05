"""Tests for the repair-null-subtraction-uploads migration.

The shared reconstruction logic is exercised through the copy revision in
``test_copy_subtractions_to_postgres``. These tests cover what this revision
owns: rebuilding uploads for subtractions that the original backfill already
wrote to Postgres with a null ``upload_id``.
"""

from datetime import datetime

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from assets.revisions.rev_n2adlt6ch803_repair_null_subtraction_upload_ids import (
    upgrade,
)
from tests.migration.test_copy_subtractions_to_postgres import (
    insert_fasta_file,
    insert_unknown_user,
    insert_upload,
    make_subtraction_document,
    setup_user,
    static_datetime,
)
from virtool.migration.ctx import MigrationContext

__all__ = ["setup_user", "static_datetime"]


async def insert_subtraction_row(
    session: AsyncSession,
    legacy_id: str,
    created_at: datetime,
    *,
    user_id: int | None,
    deleted: bool = False,
) -> int:
    """Insert a subtraction row with a null upload_id, as the backfill left it."""
    result = await session.execute(
        text("""
            INSERT INTO subtractions (
                legacy_id, name, nickname, created_at, deleted, ready, user_id
            )
            VALUES (
                :legacy_id, 'Arabidopsis thaliana', '', :created_at, :deleted, true,
                :user_id
            )
            RETURNING id
        """),
        {
            "legacy_id": legacy_id,
            "created_at": created_at,
            "deleted": deleted,
            "user_id": user_id,
        },
    )
    subtraction_pk = result.scalar_one()
    await session.commit()
    return subtraction_pk


class TestRepair:
    async def test_reconstructs_removed_upload(
        self,
        ctx: MigrationContext,
        setup_user: int,
        static_datetime: datetime,
    ):
        """A null upload_id is filled with a removed upload rebuilt from the file."""
        async with AsyncSession(ctx.pg) as session:
            await insert_subtraction_row(
                session,
                "orphan",
                static_datetime,
                user_id=setup_user,
            )
            await insert_fasta_file(session, "orphan", 8192)

        await ctx.mongo.subtraction.insert_one(
            make_subtraction_document(
                subtraction_id="orphan",
                user_id=setup_user,
                created_at=static_datetime,
                upload=999999,
            ),
        )

        await upgrade(ctx)

        async with AsyncSession(ctx.pg) as session:
            row = (
                await session.execute(
                    text("""
                        SELECT u.name, u.size, u.removed, u.user_id
                        FROM subtractions s
                        JOIN uploads u ON s.upload_id = u.id
                        WHERE s.legacy_id = 'orphan'
                    """),
                )
            ).one()

        assert row.name == "subtraction.fa.gz"
        assert row.size == 8192
        assert row.removed is True
        assert row.user_id == setup_user

    @pytest.mark.usefixtures("setup_user")
    async def test_orphan_user_uses_unknown_sentinel(
        self,
        ctx: MigrationContext,
        static_datetime: datetime,
    ):
        """A subtraction with a null user_id attributes its upload to unknown."""
        async with AsyncSession(ctx.pg) as session:
            unknown_user_id = await insert_unknown_user(session)
            await insert_subtraction_row(
                session,
                "orphan_both",
                static_datetime,
                user_id=None,
            )

        await ctx.mongo.subtraction.insert_one(
            make_subtraction_document(
                subtraction_id="orphan_both",
                user_id="gone",
                created_at=static_datetime,
                upload=999999,
            ),
        )

        await upgrade(ctx)

        async with AsyncSession(ctx.pg) as session:
            upload_user_id = (
                await session.execute(
                    text("""
                        SELECT u.user_id
                        FROM subtractions s
                        JOIN uploads u ON s.upload_id = u.id
                        WHERE s.legacy_id = 'orphan_both'
                    """),
                )
            ).scalar_one()

        assert upload_user_id == unknown_user_id

    async def test_relinks_upload_that_reappeared(
        self,
        ctx: MigrationContext,
        setup_user: int,
        static_datetime: datetime,
    ):
        """An upload present in Postgres is linked rather than duplicated."""
        async with AsyncSession(ctx.pg) as session:
            upload_id = await insert_upload(session, setup_user, "live.fa.gz")
            await insert_subtraction_row(
                session,
                "reappeared",
                static_datetime,
                user_id=setup_user,
            )

        await ctx.mongo.subtraction.insert_one(
            make_subtraction_document(
                subtraction_id="reappeared",
                user_id=setup_user,
                created_at=static_datetime,
                upload=upload_id,
            ),
        )

        await upgrade(ctx)

        async with AsyncSession(ctx.pg) as session:
            row = (
                await session.execute(
                    text("""
                        SELECT s.upload_id, u.removed
                        FROM subtractions s
                        JOIN uploads u ON s.upload_id = u.id
                        WHERE s.legacy_id = 'reappeared'
                    """),
                )
            ).one()

        assert row.upload_id == upload_id
        assert row.removed is False

    async def test_skips_soft_deleted(
        self,
        ctx: MigrationContext,
        setup_user: int,
        static_datetime: datetime,
    ):
        """A soft-deleted subtraction with a null upload_id is left untouched."""
        async with AsyncSession(ctx.pg) as session:
            await insert_subtraction_row(
                session,
                "deleted",
                static_datetime,
                user_id=setup_user,
                deleted=True,
            )

        await ctx.mongo.subtraction.insert_one(
            make_subtraction_document(
                subtraction_id="deleted",
                user_id=setup_user,
                created_at=static_datetime,
                deleted=True,
                upload=999999,
            ),
        )

        await upgrade(ctx)

        async with AsyncSession(ctx.pg) as session:
            upload_id = (
                await session.execute(
                    text(
                        "SELECT upload_id FROM subtractions "
                        "WHERE legacy_id = 'deleted'",
                    ),
                )
            ).scalar_one()

        assert upload_id is None

    async def test_idempotent_rerun(
        self,
        ctx: MigrationContext,
        setup_user: int,
        static_datetime: datetime,
    ):
        """Re-running after a full repair does not create a second upload."""
        async with AsyncSession(ctx.pg) as session:
            await insert_subtraction_row(
                session,
                "repeat",
                static_datetime,
                user_id=setup_user,
            )

        await ctx.mongo.subtraction.insert_one(
            make_subtraction_document(
                subtraction_id="repeat",
                user_id=setup_user,
                created_at=static_datetime,
                upload=999999,
            ),
        )

        await upgrade(ctx)
        await upgrade(ctx)

        async with AsyncSession(ctx.pg) as session:
            upload_count = (
                await session.execute(text("SELECT COUNT(*) FROM uploads"))
            ).scalar_one()

        assert upload_count == 1
