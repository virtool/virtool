"""Tests for the compare reference rights drift check.

The compare pass is read-only: it reports drift between Mongo's embedded rights
arrays and the backfilled Postgres join tables and raises on any disagreement. The
backfill itself is exercised in ``test_copy_references_to_postgres``; these tests
cover only what the compare owns -- matching a clean backfill, detecting rights
that were changed out from under it, canonicalising legacy string group ids the
way the read path does, and not mistaking a skipped deleted-group grant for drift.
"""

from datetime import datetime

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from assets.revisions.rev_t4u44jre75a0_copy_references_to_postgres import (
    upgrade as backfill,
)
from assets.revisions.rev_td1a0rtqlp32_compare_reference_rights import (
    upgrade as compare,
)
from tests.migration.test_copy_references_to_postgres import (
    get_reference_pk,
    insert_group,
    make_reference_document,
    make_rights_member,
    setup_user,
    static_datetime,
)
from virtool.migration.ctx import MigrationContext

__all__ = ["setup_user", "static_datetime"]


async def insert_legacy_group(
    session: AsyncSession,
    name: str,
    legacy_id: str,
) -> int:
    """Insert a group carrying a legacy id and return its integer primary key."""
    result = await session.execute(
        text(
            "INSERT INTO groups (name, legacy_id, permissions) "
            "VALUES (:name, :legacy_id, '{}') RETURNING id",
        ),
        {"name": name, "legacy_id": legacy_id},
    )
    group_id = result.scalar_one()
    await session.commit()
    return group_id


class TestCompareReferenceRights:
    async def test_clean_backfill_passes(
        self,
        ctx: MigrationContext,
        setup_user: int,
        static_datetime: datetime,
    ):
        """A reference whose rights were faithfully backfilled reports no drift."""
        async with AsyncSession(ctx.pg) as session:
            group_id = await insert_group(session, "Technicians")

        await ctx.mongo.references.insert_one(
            make_reference_document(
                "clean_reference",
                setup_user,
                static_datetime,
                users=[
                    make_rights_member(
                        setup_user,
                        static_datetime,
                        build=True,
                        modify=True,
                    ),
                ],
                groups=[
                    make_rights_member(group_id, static_datetime, modify_otu=True),
                ],
            ),
        )

        await backfill(ctx)

        await compare(ctx)

    async def test_group_rights_drift_raises(
        self,
        ctx: MigrationContext,
        setup_user: int,
        static_datetime: datetime,
    ):
        """A group grant changed in Postgres after backfill is flagged as drift."""
        async with AsyncSession(ctx.pg) as session:
            group_id = await insert_group(session, "Technicians")

        await ctx.mongo.references.insert_one(
            make_reference_document(
                "group_drift_reference",
                setup_user,
                static_datetime,
                groups=[
                    make_rights_member(group_id, static_datetime, modify_otu=True),
                ],
            ),
        )

        await backfill(ctx)

        async with AsyncSession(ctx.pg) as session:
            reference_pk = await get_reference_pk(session, "group_drift_reference")
            await session.execute(
                text(
                    "UPDATE legacy_reference_groups SET modify_otu = false "
                    "WHERE reference_id = :reference_id AND group_id = :group_id",
                ),
                {"reference_id": reference_pk, "group_id": group_id},
            )
            await session.commit()

        with pytest.raises(ValueError, match="drift detected in 1 references"):
            await compare(ctx)

    async def test_user_rights_drift_raises(
        self,
        ctx: MigrationContext,
        setup_user: int,
        static_datetime: datetime,
    ):
        """A user grant changed in Postgres after backfill is flagged as drift."""
        await ctx.mongo.references.insert_one(
            make_reference_document(
                "user_drift_reference",
                setup_user,
                static_datetime,
                users=[
                    make_rights_member(setup_user, static_datetime, build=True),
                ],
            ),
        )

        await backfill(ctx)

        async with AsyncSession(ctx.pg) as session:
            reference_pk = await get_reference_pk(session, "user_drift_reference")
            await session.execute(
                text(
                    "UPDATE legacy_reference_users SET build = false "
                    "WHERE reference_id = :reference_id AND user_id = :user_id",
                ),
                {"reference_id": reference_pk, "user_id": setup_user},
            )
            await session.commit()

        with pytest.raises(ValueError, match="drift detected in 1 references"):
            await compare(ctx)

    async def test_missing_grant_in_postgres_raises(
        self,
        ctx: MigrationContext,
        setup_user: int,
        static_datetime: datetime,
    ):
        """A grant present in Mongo but deleted from Postgres is flagged as drift."""
        await ctx.mongo.references.insert_one(
            make_reference_document(
                "deleted_grant_reference",
                setup_user,
                static_datetime,
                users=[
                    make_rights_member(setup_user, static_datetime, build=True),
                ],
            ),
        )

        await backfill(ctx)

        async with AsyncSession(ctx.pg) as session:
            reference_pk = await get_reference_pk(session, "deleted_grant_reference")
            await session.execute(
                text(
                    "DELETE FROM legacy_reference_users "
                    "WHERE reference_id = :reference_id",
                ),
                {"reference_id": reference_pk},
            )
            await session.commit()

        with pytest.raises(ValueError, match="drift detected in 1 references"):
            await compare(ctx)

    async def test_legacy_string_group_id_is_not_drift(
        self,
        ctx: MigrationContext,
        setup_user: int,
        static_datetime: datetime,
    ):
        """A grant addressing a group by its legacy string id matches the backfill.

        The read path canonicalises the legacy id to the group's integer primary
        key, and so must the compare, or every reference migrated before groups
        moved to integer ids would report false drift.
        """
        async with AsyncSession(ctx.pg) as session:
            await insert_legacy_group(session, "Technicians", "legacy_group_1")

        await ctx.mongo.references.insert_one(
            make_reference_document(
                "legacy_group_reference",
                setup_user,
                static_datetime,
                groups=[
                    make_rights_member(
                        "legacy_group_1",
                        static_datetime,
                        modify_otu=True,
                    ),
                ],
            ),
        )

        await backfill(ctx)

        await compare(ctx)

    async def test_deleted_group_grant_is_not_drift(
        self,
        ctx: MigrationContext,
        setup_user: int,
        static_datetime: datetime,
    ):
        """A grant to a group missing from Postgres is dropped, not flagged.

        The backfill skips grants to deleted groups, so Postgres legitimately holds
        no row for them and the compare must not treat the absence as drift.
        """
        await ctx.mongo.references.insert_one(
            make_reference_document(
                "deleted_group_reference",
                setup_user,
                static_datetime,
                groups=[
                    make_rights_member(999999, static_datetime, modify_otu=True),
                ],
            ),
        )

        await backfill(ctx)

        await compare(ctx)
