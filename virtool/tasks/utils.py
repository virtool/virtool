import aiojobs
import asyncio


import virtool.tasks.task


async def spawn_periodically(scheduler: aiojobs.Scheduler, task: virtool.tasks.task.Task,  interval: int):
    """
    Spawn a task regularly at a given interval.

    :param scheduler: an aiojobs container for managed jobs.
    :param task: a Virtool task
    :param interval: a time interval

    """
    try:
        while True:
            await scheduler.spawn(task.run())
            await asyncio.sleep(interval)
    except asyncio.CancelledError:
        pass
