import pytest
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.dispatcher.events import DispatcherSQLEvents
from virtool.labels.models import Label


@pytest.mark.parametrize("rollback", [False, True])
async def test_events(rollback, mocker, pg: AsyncEngine):
    """
    Test that changes are recorded as needed and not recorded when a transaction is rolled back.
    Specifically, make sure changes aren't recorded for both flushed and un-flushed changes.

    """
    changes = list()

    def enqueue_change(*args):
        changes.append(args)

    DispatcherSQLEvents(enqueue_change)

    async with AsyncSession(pg) as session:
        session.add(Label(name="Test 1", color="#D97706", description="This is a test"))
        await session.commit()

    assert changes == [("labels", "insert", [1])]

    async with AsyncSession(pg) as session:
        session.add(
            Label(name="Test 2", color="#000000", description="This is a test again")
        )
        session.add(
            Label(
                name="Test 3", color="#FFFFFF", description="This is a test yet again"
            )
        )

        await session.flush()

        session.add(
            Label(
                name="Test 4", color="#DDDDDD", description="This is a test after flush"
            )
        )

        if rollback:
            await session.rollback()
        else:
            await session.commit()

    expected = [("labels", "insert", [1])]

    if rollback:
        assert changes == expected
    else:
        assert changes == expected + [
            ("labels", "insert", [2]),
            ("labels", "insert", [3]),
            ("labels", "insert", [4]),
        ]
