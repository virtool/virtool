"""Tests for the copy history to postgres migration."""

import asyncio
from collections.abc import Callable
from datetime import datetime

import arrow
import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from assets.revisions.rev_iltemfg2gul8_copy_history_to_postgres import upgrade
from virtool.migration.ctx import MigrationContext


@pytest.fixture
def static_datetime() -> datetime:
    return arrow.get(2024, 1, 15, 12, 0, 0).naive


@pytest.fixture
async def setup_user(ctx: MigrationContext, apply_alembic: Callable) -> int:
    """Apply the schema up to the legacy_history table and create a user.

    ``adea254e2c31`` renames the ``legacy_history`` reference columns to their final
    names; applying it brings up the ``users`` and ``legacy_history`` tables this
    backfill needs.
    """
    await asyncio.to_thread(apply_alembic, "adea254e2c31")

    async with AsyncSession(ctx.pg) as session:
        result = await session.execute(
            text("""
                INSERT INTO users (
                    handle, legacy_id, active, email, force_reset,
                    invalidate_sessions, last_password_change, password, settings
                )
                VALUES (
                    'testuser', 'legacy_user_123', true, '', false,
                    false, :now, :password, '{}'::jsonb
                )
                RETURNING id
            """),
            {"now": arrow.utcnow().naive, "password": b"hashed_password"},
        )
        user_id = result.scalar_one()
        await session.commit()
        return user_id


def make_history_document(
    change_id: str,
    user_id: str | int,
    created_at: datetime,
    *,
    otu_version: int | str = 3,
    index_id: str = "index_1",
    index_version: int | str = 2,
    method_name: str = "edit",
) -> dict:
    """Create a MongoDB history document for testing."""
    return {
        "_id": change_id,
        "created_at": created_at,
        "description": "Edited Foo Virus",
        "diff": "postgres",
        "index": {"id": index_id, "version": index_version},
        "method_name": method_name,
        "otu": {"id": "otu_1", "name": "Foo Virus", "version": otu_version},
        "reference": {"id": "reference_1"},
        "user": {"id": user_id},
    }


class TestUpgrade:
    """Tests for the upgrade function."""

    async def test_basic_migration(
        self,
        ctx: MigrationContext,
        setup_user: int,
        static_datetime: datetime,
    ):
        """A history document is copied with every field mapped correctly."""
        await ctx.mongo.history.insert_one(
            make_history_document(
                change_id="otu_1.3",
                user_id="legacy_user_123",
                created_at=static_datetime,
            ),
        )

        await upgrade(ctx)

        async with AsyncSession(ctx.pg) as session:
            row = (
                await session.execute(
                    text("""
                        SELECT legacy_id, created_at, description, method_name,
                               user_id, otu, otu_name, otu_version, reference,
                               "index", index_version
                        FROM legacy_history WHERE legacy_id = 'otu_1.3'
                    """),
                )
            ).one()

        assert row.legacy_id == "otu_1.3"
        assert row.created_at == static_datetime
        assert row.description == "Edited Foo Virus"
        assert row.method_name == "edit"
        assert row.user_id == setup_user
        assert row.otu == "otu_1"
        assert row.otu_name == "Foo Virus"
        assert row.otu_version == "3"
        assert row.reference == "reference_1"
        assert row.index == "index_1"
        assert row.index_version == "2"

    @pytest.mark.usefixtures("setup_user")
    async def test_removed_otu_version_maps_null(
        self,
        ctx: MigrationContext,
        static_datetime: datetime,
    ):
        """An ``otu.version`` of ``"removed"`` is stored as NULL."""
        await ctx.mongo.history.insert_one(
            make_history_document(
                change_id="otu_1.removed",
                user_id="legacy_user_123",
                created_at=static_datetime,
                otu_version="removed",
                method_name="remove",
            ),
        )

        await upgrade(ctx)

        async with AsyncSession(ctx.pg) as session:
            otu_version = (
                await session.execute(
                    text(
                        "SELECT otu_version FROM legacy_history "
                        "WHERE legacy_id = 'otu_1.removed'",
                    ),
                )
            ).scalar_one()

        assert otu_version is None

    @pytest.mark.usefixtures("setup_user")
    async def test_unbuilt_index_maps_null(
        self,
        ctx: MigrationContext,
        static_datetime: datetime,
    ):
        """An ``unbuilt`` index id and version are both stored as NULL."""
        await ctx.mongo.history.insert_one(
            make_history_document(
                change_id="otu_1.4",
                user_id="legacy_user_123",
                created_at=static_datetime,
                index_id="unbuilt",
                index_version="unbuilt",
            ),
        )

        await upgrade(ctx)

        async with AsyncSession(ctx.pg) as session:
            row = (
                await session.execute(
                    text(
                        'SELECT "index", index_version FROM legacy_history '
                        "WHERE legacy_id = 'otu_1.4'",
                    ),
                )
            ).one()

        assert row.index is None
        assert row.index_version is None

    async def test_integer_user_id_used_directly(
        self,
        ctx: MigrationContext,
        setup_user: int,
        static_datetime: datetime,
    ):
        """A modern integer ``user.id`` is used directly as the Postgres FK."""
        await ctx.mongo.history.insert_one(
            make_history_document(
                change_id="otu_1.5",
                user_id=setup_user,
                created_at=static_datetime,
            ),
        )

        await upgrade(ctx)

        async with AsyncSession(ctx.pg) as session:
            user_id = (
                await session.execute(
                    text(
                        "SELECT user_id FROM legacy_history "
                        "WHERE legacy_id = 'otu_1.5'",
                    ),
                )
            ).scalar_one()

        assert user_id == setup_user

    async def test_skip_existing(
        self,
        ctx: MigrationContext,
        setup_user: int,
        static_datetime: datetime,
    ):
        """A document already present in Postgres is not duplicated."""
        await ctx.mongo.history.insert_one(
            make_history_document(
                change_id="otu_1.6",
                user_id="legacy_user_123",
                created_at=static_datetime,
            ),
        )

        async with AsyncSession(ctx.pg) as session:
            await session.execute(
                text("""
                    INSERT INTO legacy_history (
                        legacy_id, created_at, description, method_name, user_id,
                        otu, otu_name, reference
                    )
                    VALUES (
                        'otu_1.6', :created_at, 'pre-existing', 'edit', :user_id,
                        'otu_1', 'Foo Virus', 'reference_1'
                    )
                """),
                {"created_at": static_datetime, "user_id": setup_user},
            )
            await session.commit()

        await upgrade(ctx)

        async with AsyncSession(ctx.pg) as session:
            row = (
                await session.execute(
                    text(
                        "SELECT COUNT(*) AS count, MAX(description) AS description "
                        "FROM legacy_history WHERE legacy_id = 'otu_1.6'",
                    ),
                )
            ).one()

        assert row.count == 1
        assert row.description == "pre-existing"

    @pytest.mark.usefixtures("setup_user")
    async def test_idempotent(
        self,
        ctx: MigrationContext,
        static_datetime: datetime,
    ):
        """Running the backfill twice over an unchanged collection is a no-op."""
        await ctx.mongo.history.insert_one(
            make_history_document(
                change_id="otu_1.7",
                user_id="legacy_user_123",
                created_at=static_datetime,
            ),
        )

        await upgrade(ctx)
        await upgrade(ctx)

        async with AsyncSession(ctx.pg) as session:
            count = (
                await session.execute(
                    text(
                        "SELECT COUNT(*) FROM legacy_history "
                        "WHERE legacy_id = 'otu_1.7'",
                    ),
                )
            ).scalar_one()

        assert count == 1

    @pytest.mark.usefixtures("setup_user")
    async def test_missing_user_raises(
        self,
        ctx: MigrationContext,
        static_datetime: datetime,
    ):
        """A document with no user raises rather than storing a null user_id."""
        document = make_history_document(
            change_id="otu_1.8",
            user_id="legacy_user_123",
            created_at=static_datetime,
        )
        del document["user"]
        await ctx.mongo.history.insert_one(document)

        with pytest.raises(ValueError, match="has no user"):
            await upgrade(ctx)

    @pytest.mark.usefixtures("setup_user")
    async def test_unresolvable_user_raises(
        self,
        ctx: MigrationContext,
        static_datetime: datetime,
    ):
        """A document whose user cannot be resolved raises."""
        await ctx.mongo.history.insert_one(
            make_history_document(
                change_id="otu_1.9",
                user_id="nonexistent_user",
                created_at=static_datetime,
            ),
        )

        with pytest.raises(ValueError, match="not found in postgres"):
            await upgrade(ctx)
