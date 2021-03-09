import aiojobs
import asyncio

import virtool.tasks.pg
import virtool.tasks.task

from virtool.types import App


async def spawn_periodically(app: App, task: virtool.tasks.task.Task,  interval: int):
    """
    Spawn a task regularly at a given interval.

    :param app: the application object.
    :param task: a Virtool task
    :param interval: a time interval

    """
    try:
        while True:
            await virtool.tasks.pg.register(app["pg"], app["task_runner"], task)
            await asyncio.sleep(interval)
    except asyncio.CancelledError:
        pass
