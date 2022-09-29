import asyncio
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncEngine
from syrupy.matchers import path_type

from virtool.mongo.transforms import apply_transforms
from virtool.tasks.transforms import AttachTaskTransform


async def test_attach_task_transform(fake2, pg: AsyncEngine, snapshot):
    await fake2.tasks.create()
    await fake2.tasks.create()
    task_2 = await fake2.tasks.create()
    task_3 = await fake2.tasks.create()

    documents = [
        {"id": 1, "task": {"id": task_2.id}},
        {"id": 2, "task": {"id": task_3.id}},
        {"id": 3, "task": None},
        {
            "id": 4,
        },
    ]

    transformed = await apply_transforms(documents, [AttachTaskTransform(pg)])

    assert transformed == snapshot(
        matcher=path_type({".*created_at": (datetime,)}, regex=True)
    )


async def test_attach_task_transform_single(fake2, pg: AsyncEngine, snapshot):
    await fake2.tasks.create()
    task = await fake2.tasks.create()

    assert await asyncio.gather(
        apply_transforms({"id": 1, "task": {"id": task.id}}, [AttachTaskTransform(pg)]),
        apply_transforms({"id": 2, "task": None}, [AttachTaskTransform(pg)]),
    ) == snapshot(matcher=path_type({".*created_at": (datetime,)}, regex=True))
