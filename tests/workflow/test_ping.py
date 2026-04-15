import asyncio
from unittest.mock import AsyncMock

import pytest

from virtool.workflow.runtime.events import Events
from virtool.workflow.runtime.ping import _ping_periodically, ping_periodically


@pytest.fixture()
def events():
    return Events()


@pytest.fixture()
def api():
    return AsyncMock()


class TestPingPeriodically:
    async def test_cancellation_from_ping(self, api, events):
        """When the ping response has cancelled=True, the events object is updated and
        the parent task is cancelled.
        """
        api.put_json = AsyncMock(return_value={"cancelled": True})

        parent_task = AsyncMock(spec=asyncio.Task)

        await _ping_periodically(api, "test_job", events, parent_task)

        assert events.cancelled.is_set()
        parent_task.cancel.assert_called_once()

    async def test_no_cancellation(self, api, events):
        """When the ping response has cancelled=False, the ping loop continues and can
        be cancelled externally.
        """
        call_count = 0

        async def mock_put_json(path, data):
            nonlocal call_count
            call_count += 1

            if call_count >= 3:
                raise asyncio.CancelledError

            return {"cancelled": False}

        api.put_json = mock_put_json

        parent_task = AsyncMock(spec=asyncio.Task)

        await _ping_periodically(api, "test_job", events, parent_task)

        assert not events.cancelled.is_set()
        parent_task.cancel.assert_not_called()


class TestPingPeriodicallyContextManager:
    async def test_cancels_on_ping_cancellation(self, api, events):
        """When the ping response indicates cancellation, the parent task running in the
        context manager is cancelled.
        """
        api.put_json = AsyncMock(return_value={"cancelled": True})

        with pytest.raises(asyncio.CancelledError):
            async with ping_periodically(api, "test_job", events):
                await asyncio.sleep(10)

        assert events.cancelled.is_set()

    async def test_normal_exit(self, api, events):
        """When the context manager exits normally, the ping task is cancelled."""
        api.put_json = AsyncMock(return_value={"cancelled": False})

        async with ping_periodically(api, "test_job", events):
            pass

        assert not events.cancelled.is_set()
