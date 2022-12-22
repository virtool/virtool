from aiohttp.test_utils import make_mocked_coro

from virtool.tasks.progress import (
    AccumulatingProgressHandlerWrapper,
    TaskProgressHandler,
)


async def test_accumulating_handler():
    set_progress = make_mocked_coro()
    set_error = make_mocked_coro()

    handler = TaskProgressHandler(set_error, set_progress)
    tracker = AccumulatingProgressHandlerWrapper(handler, 24)

    await tracker.add(3)

    # Expect rounded 3 / 24 * 100.
    set_progress.assert_called_with(
        12,
    )

    await tracker.add(3)

    # Expect rounded 8 / 24 * 100.
    set_progress.assert_called_with(
        25,
    )

    await tracker.add(18)

    set_progress.assert_called_with(
        100,
    )
