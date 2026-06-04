"""Tests for the copy subtractions to postgres migration."""

import asyncio
from collections.abc import Callable
from datetime import datetime

import arrow
import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from assets.revisions.rev_ztd04qgecm9a_copy_subtractions_to_postgres import (
    required_alembic_revision,
    upgrade,
)
from virtool.migration.ctx import MigrationContext


@pytest.fixture
def static_datetime() -> datetime:
    return arrow.get(2024, 1, 15, 12, 0, 0).naive


@pytest.fixture
async def setup_user(ctx: MigrationContext, apply_alembic: Callable) -> int:
    """Create a user in PostgreSQL using raw SQL and return their integer id."""
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
            {"now": arrow.utcnow().naive, "password": b"hashed_password"},
        )
        user_id = result.scalar_one()
        await session.commit()
        return user_id


async def insert_job(session: AsyncSession, user_id: int, created_at: datetime) -> int:
    """Insert a job and return its integer primary key."""
    result = await session.execute(
        text("""
            INSERT INTO jobs (legacy_id, workflow, state, user_id, created_at)
            VALUES ('legacy_job', 'create_subtraction', 'succeeded', :user_id, :now)
            RETURNING id
        """),
        {"user_id": user_id, "now": created_at},
    )
    job_id = result.scalar_one()
    await session.commit()
    return job_id


async def insert_upload(
    session: AsyncSession,
    user_id: int,
    name_on_disk: str,
) -> int:
    """Insert an upload and return its integer primary key."""
    result = await session.execute(
        text("""
            INSERT INTO uploads (name, name_on_disk, ready, removed, reserved, type, user_id)
            VALUES ('subtraction.fa.gz', :name_on_disk, true, false, false,
                    'subtraction', :user_id)
            RETURNING id
        """),
        {"name_on_disk": name_on_disk, "user_id": user_id},
    )
    upload_id = result.scalar_one()
    await session.commit()
    return upload_id


def make_subtraction_document(
    subtraction_id: str,
    user_id: int | str,
    created_at: datetime,
    *,
    name: str = "Arabidopsis thaliana",
    nickname: str = "Thalecress",
    count: int | None = 12,
    gc: dict | None = None,
    deleted: bool = False,
    ready: bool = True,
    job_id: int | str | None = None,
    upload: int | None = None,
) -> dict:
    """Create a MongoDB subtraction document for testing."""
    return {
        "_id": subtraction_id,
        "count": count,
        "created_at": created_at,
        "deleted": deleted,
        "file": {"id": upload, "name": "subtraction.fa.gz"},
        "gc": gc if gc is not None else {"a": 0.25, "t": 0.25, "g": 0.25, "c": 0.25},
        "job": {"id": job_id} if job_id is not None else None,
        "name": name,
        "nickname": nickname,
        "ready": ready,
        "space": {"id": 1},
        "upload": upload,
        "user": {"id": user_id},
    }


class TestUpgrade:
    """Tests for the upgrade function."""

    async def test_field_fidelity(
        self,
        ctx: MigrationContext,
        setup_user: int,
        static_datetime: datetime,
    ):
        """A document's scalar and json fields map correctly."""
        await ctx.mongo.subtraction.insert_one(
            make_subtraction_document(
                subtraction_id="subtraction_1",
                user_id=setup_user,
                created_at=static_datetime,
                count=42,
                gc={"a": 0.3, "t": 0.3, "g": 0.2, "c": 0.2},
            ),
        )

        await upgrade(ctx)

        async with AsyncSession(ctx.pg) as session:
            row = (
                await session.execute(
                    text("""
                        SELECT id, legacy_id, name, nickname, count, gc, created_at,
                               deleted, ready, user_id, job_id, upload_id
                        FROM subtractions WHERE legacy_id = 'subtraction_1'
                    """),
                )
            ).one()

        assert isinstance(row.id, int)
        assert row.legacy_id == "subtraction_1"
        assert row.name == "Arabidopsis thaliana"
        assert row.nickname == "Thalecress"
        assert row.count == 42
        assert row.gc == {"a": 0.3, "t": 0.3, "g": 0.2, "c": 0.2}
        assert row.created_at == static_datetime
        assert row.deleted is False
        assert row.ready is True
        assert row.user_id == setup_user
        assert row.job_id is None
        assert row.upload_id is None

    async def test_user_legacy_id_mapping(
        self,
        ctx: MigrationContext,
        setup_user: int,
        static_datetime: datetime,
    ):
        """A legacy string user id resolves to the user's integer primary key."""
        await ctx.mongo.subtraction.insert_one(
            make_subtraction_document(
                subtraction_id="legacy_user_subtraction",
                user_id="legacy_user_123",
                created_at=static_datetime,
            ),
        )

        await upgrade(ctx)

        async with AsyncSession(ctx.pg) as session:
            stored = (
                await session.execute(
                    text(
                        "SELECT user_id FROM subtractions "
                        "WHERE legacy_id = 'legacy_user_subtraction'",
                    ),
                )
            ).scalar_one()

        assert stored == setup_user

    async def test_job_id_mapping(
        self,
        ctx: MigrationContext,
        setup_user: int,
        static_datetime: datetime,
    ):
        """An integer job id is written to the job_id foreign key."""
        async with AsyncSession(ctx.pg) as session:
            job_id = await insert_job(session, setup_user, static_datetime)

        await ctx.mongo.subtraction.insert_one(
            make_subtraction_document(
                subtraction_id="job_subtraction",
                user_id=setup_user,
                created_at=static_datetime,
                job_id=job_id,
            ),
        )

        await upgrade(ctx)

        async with AsyncSession(ctx.pg) as session:
            stored = (
                await session.execute(
                    text(
                        "SELECT job_id FROM subtractions "
                        "WHERE legacy_id = 'job_subtraction'",
                    ),
                )
            ).scalar_one()

        assert stored == job_id

    async def test_upload_id_mapping(
        self,
        ctx: MigrationContext,
        setup_user: int,
        static_datetime: datetime,
    ):
        """An integer upload id is written to the upload_id foreign key."""
        async with AsyncSession(ctx.pg) as session:
            upload_id = await insert_upload(session, setup_user, "subtraction_1.fa.gz")

        await ctx.mongo.subtraction.insert_one(
            make_subtraction_document(
                subtraction_id="upload_subtraction",
                user_id=setup_user,
                created_at=static_datetime,
                upload=upload_id,
            ),
        )

        await upgrade(ctx)

        async with AsyncSession(ctx.pg) as session:
            stored = (
                await session.execute(
                    text(
                        "SELECT upload_id FROM subtractions "
                        "WHERE legacy_id = 'upload_subtraction'",
                    ),
                )
            ).scalar_one()

        assert stored == upload_id

    async def test_no_job_or_upload(
        self,
        ctx: MigrationContext,
        setup_user: int,
        static_datetime: datetime,
    ):
        """job_id and upload_id are null when the document has neither."""
        await ctx.mongo.subtraction.insert_one(
            make_subtraction_document(
                subtraction_id="bare_subtraction",
                user_id=setup_user,
                created_at=static_datetime,
                job_id=None,
                upload=None,
            ),
        )

        await upgrade(ctx)

        async with AsyncSession(ctx.pg) as session:
            row = (
                await session.execute(
                    text(
                        "SELECT job_id, upload_id FROM subtractions "
                        "WHERE legacy_id = 'bare_subtraction'",
                    ),
                )
            ).one()

        assert row.job_id is None
        assert row.upload_id is None

    async def test_orphan_user_backfills_null(
        self,
        ctx: MigrationContext,
        setup_user: int,
        static_datetime: datetime,
    ):
        """A document referencing a missing user is written with a null user_id.

        Unlike the analyses backfill, an unresolvable user reference does not abort
        the migration: the row is written with ``user_id = NULL``.
        """
        await ctx.mongo.subtraction.insert_one(
            make_subtraction_document(
                subtraction_id="orphan_user_subtraction",
                user_id=setup_user + 9999,
                created_at=static_datetime,
            ),
        )

        await upgrade(ctx)

        async with AsyncSession(ctx.pg) as session:
            row = (
                await session.execute(
                    text(
                        "SELECT user_id FROM subtractions "
                        "WHERE legacy_id = 'orphan_user_subtraction'",
                    ),
                )
            ).one()

        assert row.user_id is None

    async def test_orphan_job_backfills_null(
        self,
        ctx: MigrationContext,
        setup_user: int,
        static_datetime: datetime,
    ):
        """A document referencing a deleted job is written with a null job_id."""
        await ctx.mongo.subtraction.insert_one(
            make_subtraction_document(
                subtraction_id="orphan_job_subtraction",
                user_id=setup_user,
                created_at=static_datetime,
                job_id="missing_job",
            ),
        )

        await upgrade(ctx)

        async with AsyncSession(ctx.pg) as session:
            row = (
                await session.execute(
                    text(
                        "SELECT job_id FROM subtractions "
                        "WHERE legacy_id = 'orphan_job_subtraction'",
                    ),
                )
            ).one()

        assert row.job_id is None

    async def test_orphan_upload_backfills_null(
        self,
        ctx: MigrationContext,
        setup_user: int,
        static_datetime: datetime,
    ):
        """A document referencing a deleted upload is written with a null upload_id."""
        await ctx.mongo.subtraction.insert_one(
            make_subtraction_document(
                subtraction_id="orphan_upload_subtraction",
                user_id=setup_user,
                created_at=static_datetime,
                upload=999999,
            ),
        )

        await upgrade(ctx)

        async with AsyncSession(ctx.pg) as session:
            row = (
                await session.execute(
                    text(
                        "SELECT upload_id FROM subtractions "
                        "WHERE legacy_id = 'orphan_upload_subtraction'",
                    ),
                )
            ).one()

        assert row.upload_id is None

    async def test_soft_deleted_is_migrated(
        self,
        ctx: MigrationContext,
        setup_user: int,
        static_datetime: datetime,
    ):
        """A soft-deleted document is migrated with deleted set to True."""
        await ctx.mongo.subtraction.insert_one(
            make_subtraction_document(
                subtraction_id="deleted_subtraction",
                user_id=setup_user,
                created_at=static_datetime,
                deleted=True,
            ),
        )

        await upgrade(ctx)

        async with AsyncSession(ctx.pg) as session:
            row = (
                await session.execute(
                    text(
                        "SELECT deleted FROM subtractions "
                        "WHERE legacy_id = 'deleted_subtraction'",
                    ),
                )
            ).one()

        assert row.deleted is True

    async def test_idempotent_rerun(
        self,
        ctx: MigrationContext,
        setup_user: int,
        static_datetime: datetime,
    ):
        """Running the migration twice leaves a single row per document."""
        await ctx.mongo.subtraction.insert_one(
            make_subtraction_document(
                subtraction_id="repeat_subtraction",
                user_id=setup_user,
                created_at=static_datetime,
            ),
        )

        await upgrade(ctx)
        await upgrade(ctx)

        async with AsyncSession(ctx.pg) as session:
            count = (
                await session.execute(
                    text(
                        "SELECT COUNT(*) FROM subtractions "
                        "WHERE legacy_id = 'repeat_subtraction'",
                    ),
                )
            ).scalar_one()

        assert count == 1

    async def test_row_count_parity_includes_soft_deleted(
        self,
        ctx: MigrationContext,
        setup_user: int,
        static_datetime: datetime,
    ):
        """The Postgres row count matches the Mongo count, including deleted docs."""
        for i in range(4):
            await ctx.mongo.subtraction.insert_one(
                make_subtraction_document(
                    subtraction_id=f"subtraction_{i}",
                    user_id=setup_user,
                    created_at=static_datetime,
                ),
            )

        await ctx.mongo.subtraction.insert_one(
            make_subtraction_document(
                subtraction_id="subtraction_deleted",
                user_id=setup_user,
                created_at=static_datetime,
                deleted=True,
            ),
        )

        await upgrade(ctx)

        mongo_count = await ctx.mongo.subtraction.count_documents({})

        async with AsyncSession(ctx.pg) as session:
            pg_count = (
                await session.execute(text("SELECT COUNT(*) FROM subtractions"))
            ).scalar_one()

        assert pg_count == mongo_count == 5

    async def test_file_subtraction_id_backfill(
        self,
        ctx: MigrationContext,
        setup_user: int,
        static_datetime: datetime,
    ):
        """subtraction_files.subtraction_id is backfilled via the legacy_id join."""
        async with AsyncSession(ctx.pg) as session:
            await session.execute(
                text("""
                    INSERT INTO subtraction_files (name, subtraction, type, size)
                    VALUES
                        ('subtraction.fa.gz', 'file_subtraction', 'fasta', 100),
                        ('subtraction.1.bt2', 'file_subtraction', 'bowtie2', 200)
                """),
            )
            await session.commit()

        await ctx.mongo.subtraction.insert_one(
            make_subtraction_document(
                subtraction_id="file_subtraction",
                user_id=setup_user,
                created_at=static_datetime,
            ),
        )

        await upgrade(ctx)

        async with AsyncSession(ctx.pg) as session:
            subtraction_pk = (
                await session.execute(
                    text(
                        "SELECT id FROM subtractions "
                        "WHERE legacy_id = 'file_subtraction'",
                    ),
                )
            ).scalar_one()

            linked = (
                (
                    await session.execute(
                        text(
                            "SELECT subtraction_id FROM subtraction_files "
                            "WHERE subtraction = 'file_subtraction'",
                        ),
                    )
                )
                .scalars()
                .all()
            )

        assert linked == [subtraction_pk, subtraction_pk]

    @pytest.mark.usefixtures("setup_user")
    async def test_empty_collection(self, ctx: MigrationContext):
        """An empty subtraction collection is a no-op."""
        await upgrade(ctx)

        async with AsyncSession(ctx.pg) as session:
            count = (
                await session.execute(text("SELECT COUNT(*) FROM subtractions"))
            ).scalar_one()

        assert count == 0
