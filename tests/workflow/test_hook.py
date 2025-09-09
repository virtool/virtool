import asyncio
from contextlib import suppress

import pytest
from pyfixtures import FixtureScope

from virtool.workflow.runtime.hook import Hook

example_hook = Hook("example_hook")


@pytest.mark.parametrize("once", [False, True])
async def test_hook(once: bool):
    call_count = 0

    @example_hook(once=once)
    async def callback():
        nonlocal call_count
        call_count += 1

    async with FixtureScope() as scope:
        await example_hook.trigger(scope)
        await example_hook.trigger(scope)
        await example_hook.trigger(scope)

    assert call_count == 1 if once else 3


async def test_hook_with_fixtures():
    """Test that a hook can consume fixtures from its scope."""
    hook_triggered = False

    @example_hook(once=True)
    async def callback(item_1, item_2, some_fixture):
        nonlocal hook_triggered
        hook_triggered = True
        assert item_1 == "item1"
        assert item_2 == "item2"
        assert some_fixture == "some_fixture"

    async with FixtureScope() as scope:
        scope["some_fixture"] = "some_fixture"
        await example_hook.trigger(scope, item_1="item1", item_2="item2")

    assert hook_triggered


async def test_failure_behaviour():
    class SpecificError(Exception): ...

    @example_hook
    def raise_error():
        raise SpecificError

    @example_hook
    async def fine():
        await asyncio.sleep(1)

    async with FixtureScope() as scope:
        with suppress(SpecificError):
            await example_hook.trigger(scope)
