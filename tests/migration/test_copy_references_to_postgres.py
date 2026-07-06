"""Tests for the copy references to postgres migration."""

import asyncio
from collections.abc import Callable
from datetime import datetime

import arrow
import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from assets.revisions.rev_t4u44jre75a0_copy_references_to_postgres import (
    required_alembic_revision,
    upgrade,
)
from virtool.migration.ctx import MigrationContext
from virtool.utils import timestamp


@pytest.fixture
def static_datetime() -> datetime:
    return arrow.get(2024, 1, 15, 12, 0, 0).naive


@pytest.fixture
async def setup_user(ctx: MigrationContext, apply_alembic: Callable) -> int:
    """Apply alembic to the required revision and seed a user with a legacy id."""
    await asyncio.to_thread(apply_alembic, required_alembic_revision)

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
            {"now": timestamp(), "password": b"hashed_password"},
        )
        user_id = result.scalar_one()
        await session.commit()
        return user_id


async def insert_group(session: AsyncSession, name: str) -> int:
    """Insert a group and return its integer primary key."""
    result = await session.execute(
        text(
            "INSERT INTO groups (name, permissions) VALUES (:name, '{}') RETURNING id",
        ),
        {"name": name},
    )
    group_id = result.scalar_one()
    await session.commit()
    return group_id


async def insert_upload(session: AsyncSession, user_id: int, name: str) -> int:
    """Insert an upload and return its integer primary key."""
    result = await session.execute(
        text("""
            INSERT INTO uploads (
                name, name_on_disk, ready, removed, reserved, type, user_id
            )
            VALUES (:name, :name, true, false, false, 'reference', :user_id)
            RETURNING id
        """),
        {"name": name, "user_id": user_id},
    )
    upload_id = result.scalar_one()
    await session.commit()
    return upload_id


async def insert_task(session: AsyncSession, created_at: datetime) -> int:
    """Insert a task and return its integer primary key."""
    result = await session.execute(
        text(
            "INSERT INTO tasks (created_at, type, complete) "
            "VALUES (:now, 'clone_reference', false) RETURNING id",
        ),
        {"now": created_at},
    )
    task_id = result.scalar_one()
    await session.commit()
    return task_id


def make_rights_member(
    member_id: int | str,
    created_at: datetime,
    *,
    build: bool = False,
    modify: bool = False,
    modify_otu: bool = False,
) -> dict:
    """Create an embedded rights member, mirroring the Mongo shape."""
    return {
        "id": member_id,
        "build": build,
        "modify": modify,
        "modify_otu": modify_otu,
        "created_at": created_at,
    }


def make_reference_document(
    reference_id: str,
    user_id: int | str,
    created_at: datetime,
    *,
    name: str = "Plant Viruses",
    description: str = "A reference of plant viruses.",
    organism: str = "virus",
    archived: bool = False,
    restrict_source_types: bool = False,
    source_types: list[str] | None = None,
    users: list[dict] | None = None,
    groups: list[dict] | None = None,
    imported_from: int | None = None,
    task_id: int | None = None,
    cloned_from: str | None = None,
) -> dict:
    """Create a MongoDB reference document in the post-conversion shape.

    ``data_type``, ``space`` and ``internal_control`` are included to prove the
    migration ignores the fields it intentionally drops.
    """
    return {
        "_id": reference_id,
        "name": name,
        "description": description,
        "organism": organism,
        "created_at": created_at,
        "archived": archived,
        "restrict_source_types": restrict_source_types,
        "source_types": source_types if source_types is not None else ["isolate"],
        "data_type": "genome",
        "space": {"id": 0},
        "internal_control": None,
        "user": {"id": user_id},
        "users": users if users is not None else [],
        "groups": groups if groups is not None else [],
        "imported_from": {"id": imported_from} if imported_from is not None else None,
        "task": {"id": task_id} if task_id is not None else None,
        "cloned_from": (
            {"id": cloned_from, "name": "Source"} if cloned_from is not None else None
        ),
    }


async def get_reference_pk(session: AsyncSession, legacy_id: str) -> int:
    """Return the integer primary key of a backfilled reference by legacy id."""
    return (
        await session.execute(
            text("SELECT id FROM legacy_references WHERE legacy_id = :legacy_id"),
            {"legacy_id": legacy_id},
        )
    ).scalar_one()


class TestUpgrade:
    """Tests for the upgrade function."""

    async def test_field_fidelity(
        self,
        ctx: MigrationContext,
        setup_user: int,
        static_datetime: datetime,
    ):
        """A document's scalar and json fields map correctly."""
        async with AsyncSession(ctx.pg) as session:
            upload_id = await insert_upload(session, setup_user, "plant.fa.gz")
            task_id = await insert_task(session, static_datetime)

        await ctx.mongo.references.insert_one(
            make_reference_document(
                "reference_1",
                setup_user,
                static_datetime,
                archived=True,
                restrict_source_types=True,
                source_types=["isolate", "strain"],
                imported_from=upload_id,
                task_id=task_id,
            ),
        )

        await upgrade(ctx)

        async with AsyncSession(ctx.pg) as session:
            row = (
                await session.execute(
                    text("""
                        SELECT id, legacy_id, name, description, organism, created_at,
                               archived, restrict_source_types, source_types, user_id,
                               upload_id, cloned_from_id, task_id
                        FROM legacy_references WHERE legacy_id = 'reference_1'
                    """),
                )
            ).one()

        assert isinstance(row.id, int)
        assert row.legacy_id == "reference_1"
        assert row.name == "Plant Viruses"
        assert row.description == "A reference of plant viruses."
        assert row.organism == "virus"
        assert row.created_at == static_datetime
        assert row.archived is True
        assert row.restrict_source_types is True
        assert row.source_types == ["isolate", "strain"]
        assert row.user_id == setup_user
        assert row.upload_id == upload_id
        assert row.cloned_from_id is None
        assert row.task_id == task_id

    async def test_user_legacy_id_mapping(
        self,
        ctx: MigrationContext,
        setup_user: int,
        static_datetime: datetime,
    ):
        """A legacy string user id resolves to the user's integer primary key."""
        await ctx.mongo.references.insert_one(
            make_reference_document(
                "legacy_user_reference",
                "legacy_user_123",
                static_datetime,
            ),
        )

        await upgrade(ctx)

        async with AsyncSession(ctx.pg) as session:
            stored = (
                await session.execute(
                    text(
                        "SELECT user_id FROM legacy_references "
                        "WHERE legacy_id = 'legacy_user_reference'",
                    ),
                )
            ).scalar_one()

        assert stored == setup_user

    async def test_missing_user_raises(
        self,
        ctx: MigrationContext,
        setup_user: int,
        static_datetime: datetime,
    ):
        """A reference whose owner is missing from postgres aborts the migration."""
        await ctx.mongo.references.insert_one(
            make_reference_document(
                "orphan_user_reference",
                setup_user + 9999,
                static_datetime,
            ),
        )

        with pytest.raises(ValueError, match="does not exist in postgres"):
            await upgrade(ctx)

    async def test_rights_rows(
        self,
        ctx: MigrationContext,
        setup_user: int,
        static_datetime: datetime,
    ):
        """Each embedded rights member becomes a join row with its rights booleans."""
        async with AsyncSession(ctx.pg) as session:
            group_id = await insert_group(session, "Technicians")

        await ctx.mongo.references.insert_one(
            make_reference_document(
                "rights_reference",
                setup_user,
                static_datetime,
                users=[
                    make_rights_member(
                        setup_user,
                        static_datetime,
                        build=True,
                        modify=True,
                        modify_otu=True,
                    ),
                ],
                groups=[
                    make_rights_member(
                        group_id,
                        static_datetime,
                        build=True,
                        modify_otu=True,
                    ),
                ],
            ),
        )

        await upgrade(ctx)

        async with AsyncSession(ctx.pg) as session:
            reference_pk = await get_reference_pk(session, "rights_reference")

            user_row = (
                await session.execute(
                    text("""
                        SELECT user_id, build, modify, modify_otu
                        FROM legacy_reference_users WHERE reference_id = :reference_id
                    """),
                    {"reference_id": reference_pk},
                )
            ).one()

            group_row = (
                await session.execute(
                    text("""
                        SELECT group_id, build, modify, modify_otu
                        FROM legacy_reference_groups WHERE reference_id = :reference_id
                    """),
                    {"reference_id": reference_pk},
                )
            ).one()

        assert user_row.user_id == setup_user
        assert (user_row.build, user_row.modify, user_row.modify_otu) == (
            True,
            True,
            True,
        )
        assert group_row.group_id == group_id
        assert (group_row.build, group_row.modify, group_row.modify_otu) == (
            True,
            False,
            True,
        )

    async def test_missing_rights_user_raises(
        self,
        ctx: MigrationContext,
        setup_user: int,
        static_datetime: datetime,
    ):
        """A rights member user missing from postgres aborts the migration."""
        await ctx.mongo.references.insert_one(
            make_reference_document(
                "orphan_rights_user",
                setup_user,
                static_datetime,
                users=[make_rights_member(setup_user + 9999, static_datetime)],
            ),
        )

        with pytest.raises(ValueError, match="does not exist in postgres"):
            await upgrade(ctx)

    async def test_missing_rights_group_raises(
        self,
        ctx: MigrationContext,
        setup_user: int,
        static_datetime: datetime,
    ):
        """A rights member group missing from postgres aborts the migration."""
        await ctx.mongo.references.insert_one(
            make_reference_document(
                "orphan_rights_group",
                setup_user,
                static_datetime,
                groups=[make_rights_member(999999, static_datetime)],
            ),
        )

        with pytest.raises(ValueError, match="does not exist in postgres"):
            await upgrade(ctx)

    async def test_cloned_from_resolved(
        self,
        ctx: MigrationContext,
        setup_user: int,
        static_datetime: datetime,
    ):
        """A clone's cloned_from_id resolves to its source, even when copied first.

        The clone is inserted into Mongo before its source so the first pass writes
        it with a null ``cloned_from_id``; the second pass links it once the source
        row exists.
        """
        await ctx.mongo.references.insert_one(
            make_reference_document(
                "clone_reference",
                setup_user,
                static_datetime,
                name="Clone",
                cloned_from="source_reference",
            ),
        )
        await ctx.mongo.references.insert_one(
            make_reference_document(
                "source_reference",
                setup_user,
                static_datetime,
                name="Source",
            ),
        )

        await upgrade(ctx)

        async with AsyncSession(ctx.pg) as session:
            source_pk = await get_reference_pk(session, "source_reference")
            cloned_from_id = (
                await session.execute(
                    text(
                        "SELECT cloned_from_id FROM legacy_references "
                        "WHERE legacy_id = 'clone_reference'",
                    ),
                )
            ).scalar_one()

        assert cloned_from_id == source_pk

    async def test_orphan_cloned_from_is_null(
        self,
        ctx: MigrationContext,
        setup_user: int,
        static_datetime: datetime,
    ):
        """A clone whose source no longer exists keeps a null cloned_from_id."""
        await ctx.mongo.references.insert_one(
            make_reference_document(
                "orphan_clone_reference",
                setup_user,
                static_datetime,
                cloned_from="deleted_source",
            ),
        )

        await upgrade(ctx)

        async with AsyncSession(ctx.pg) as session:
            cloned_from_id = (
                await session.execute(
                    text(
                        "SELECT cloned_from_id FROM legacy_references "
                        "WHERE legacy_id = 'orphan_clone_reference'",
                    ),
                )
            ).scalar_one()

        assert cloned_from_id is None

    async def test_missing_upload_is_null(
        self,
        ctx: MigrationContext,
        setup_user: int,
        static_datetime: datetime,
    ):
        """upload_id is null when the imported upload no longer exists."""
        await ctx.mongo.references.insert_one(
            make_reference_document(
                "orphan_upload_reference",
                setup_user,
                static_datetime,
                imported_from=999999,
            ),
        )

        await upgrade(ctx)

        async with AsyncSession(ctx.pg) as session:
            upload_id = (
                await session.execute(
                    text(
                        "SELECT upload_id FROM legacy_references "
                        "WHERE legacy_id = 'orphan_upload_reference'",
                    ),
                )
            ).scalar_one()

        assert upload_id is None

    async def test_missing_task_is_null(
        self,
        ctx: MigrationContext,
        setup_user: int,
        static_datetime: datetime,
    ):
        """task_id is null when the referenced task no longer exists."""
        await ctx.mongo.references.insert_one(
            {
                **make_reference_document(
                    "orphan_task_reference",
                    setup_user,
                    static_datetime,
                ),
                "task": {"id": 999999},
            },
        )

        await upgrade(ctx)

        async with AsyncSession(ctx.pg) as session:
            task_id = (
                await session.execute(
                    text(
                        "SELECT task_id FROM legacy_references "
                        "WHERE legacy_id = 'orphan_task_reference'",
                    ),
                )
            ).scalar_one()

        assert task_id is None

    async def test_idempotent_rerun(
        self,
        ctx: MigrationContext,
        setup_user: int,
        static_datetime: datetime,
    ):
        """A re-run leaves a single reference row and a single set of rights rows."""
        async with AsyncSession(ctx.pg) as session:
            group_id = await insert_group(session, "Technicians")

        await ctx.mongo.references.insert_one(
            make_reference_document(
                "repeat_reference",
                setup_user,
                static_datetime,
                users=[make_rights_member(setup_user, static_datetime, build=True)],
                groups=[make_rights_member(group_id, static_datetime, modify=True)],
            ),
        )

        await upgrade(ctx)
        await upgrade(ctx)

        async with AsyncSession(ctx.pg) as session:
            reference_count = (
                await session.execute(
                    text(
                        "SELECT COUNT(*) FROM legacy_references "
                        "WHERE legacy_id = 'repeat_reference'",
                    ),
                )
            ).scalar_one()
            reference_pk = await get_reference_pk(session, "repeat_reference")
            user_count = (
                await session.execute(
                    text(
                        "SELECT COUNT(*) FROM legacy_reference_users "
                        "WHERE reference_id = :reference_id",
                    ),
                    {"reference_id": reference_pk},
                )
            ).scalar_one()
            group_count = (
                await session.execute(
                    text(
                        "SELECT COUNT(*) FROM legacy_reference_groups "
                        "WHERE reference_id = :reference_id",
                    ),
                    {"reference_id": reference_pk},
                )
            ).scalar_one()

        assert reference_count == 1
        assert user_count == 1
        assert group_count == 1

    async def test_row_count_parity(
        self,
        ctx: MigrationContext,
        setup_user: int,
        static_datetime: datetime,
    ):
        """The Postgres row count matches the Mongo document count."""
        for i in range(4):
            await ctx.mongo.references.insert_one(
                make_reference_document(f"reference_{i}", setup_user, static_datetime),
            )

        await upgrade(ctx)

        mongo_count = await ctx.mongo.references.count_documents({})

        async with AsyncSession(ctx.pg) as session:
            pg_count = (
                await session.execute(text("SELECT COUNT(*) FROM legacy_references"))
            ).scalar_one()

        assert pg_count == mongo_count == 4

    @pytest.mark.usefixtures("setup_user")
    async def test_empty_collection(self, ctx: MigrationContext):
        """An empty references collection is a no-op."""
        await upgrade(ctx)

        async with AsyncSession(ctx.pg) as session:
            count = (
                await session.execute(text("SELECT COUNT(*) FROM legacy_references"))
            ).scalar_one()

        assert count == 0
