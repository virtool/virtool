from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.data.transforms import AbstractTransform
from virtool.tasks.sql import SQLTask
from virtool.types import Document


class AttachTaskTransform(AbstractTransform):
    """Attaches more complete task data to a document with a `task.id` field."""

    def __init__(self, pg: AsyncEngine):
        self._pg = pg

    async def attach_one(self, document, prepared):
        if "task" not in document or document["task"] is None:
            return document

        return {**document, "task": prepared}

    async def attach_many(
        self, documents: list[Document], prepared: dict[int, Any]
    ) -> list[Document]:
        attached = []

        for document in documents:
            task = document.get("task")

            if task is None:
                attached.append(document)
                continue

            attached.append({**document, "task": prepared[task["id"]]})

        return attached

    async def prepare_one(self, document, session: AsyncSession) -> Document | None:
        task = document.get("task")

        if task is None:
            return None

        result = (
            await session.execute(select(SQLTask).filter_by(id=task["id"]))
        ).scalar()

        if result is None:
            raise ValueError(f"Task not found: {task['id']}")

        return result.to_dict()

    async def prepare_many(
        self, documents: list[Document], session: AsyncSession
    ) -> dict[int | str, Any]:
        task_ids = {
            document["task"]["id"]
            for document in documents
            if document.get("task") is not None
        }
        task_ids = list(task_ids)

        if not task_ids:
            return {}

        results = await session.execute(select(SQLTask).where(SQLTask.id.in_(task_ids)))

        return {task.id: task.to_dict() for task in results.scalars()}
