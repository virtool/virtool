import datetime
from dataclasses import asdict

import arrow
import pytest
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from syrupy.matchers import path_type

from virtool.migration.pg import (
    SQLRevision,
    check_revision_applied,
    fetch_last_applied_revision,
    list_applied_revisions,
)


@pytest.fixture
async def applied_revisions(pg: AsyncEngine):
    async with AsyncSession(pg) as session:
        session.add(
            SQLRevision(
                applied_at=arrow.utcnow().naive,
                created_at=arrow.utcnow().naive,
                name="Test 1",
                revision="test_1",
            )
        )
        session.add(
            SQLRevision(
                applied_at=arrow.utcnow().shift(minutes=23).naive,
                created_at=arrow.utcnow().naive,
                name="Test 2",
                revision="test_2",
            )
        )

        await session.commit()


@pytest.mark.parametrize("revision", ["test_1", "test_2"])
async def test_check_revision_applied(
    revision: str, applied_revisions, pg: AsyncEngine
):
    """Test that a revision is found in the database."""
    assert await check_revision_applied(pg, revision) is True


async def test_check_revision_applied_not_found(pg: AsyncEngine):
    """Test that a revision is not found in the database."""
    assert await check_revision_applied(pg, "test_3") is False


async def test_list_applied_revisions(applied_revisions, pg: AsyncEngine, snapshot):
    revisions = await list_applied_revisions(pg)

    assert [asdict(revision) for revision in revisions] == snapshot(
        matcher=path_type(
            {
                ".*applied_at": (datetime.datetime,),
                ".*created_at": (datetime.datetime,),
            },
            regex=True,
        )
    )


async def test_fetch_last_applied_revision(applied_revisions, pg: AsyncEngine):
    """Test that the last applied revision is returned."""
    revision = await fetch_last_applied_revision(pg)

    assert revision.name == "Test 2"
    assert revision.revision == "test_2"


async def test_fetch_last_applied_revision_none(pg: AsyncEngine):
    """Test that `None` is returned if no revisions have been applied."""
    assert await fetch_last_applied_revision(pg) is None
