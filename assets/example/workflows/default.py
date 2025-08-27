import asyncio

from virtool.workflow import step


@step
async def step_1() -> None:
    """The first step of the workflow."""
    await asyncio.sleep(1)


@step
async def step_2(step_number, results) -> None:
    """The second step of the workflow."""
    await asyncio.sleep(3)
