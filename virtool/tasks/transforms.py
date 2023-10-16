from typing import List, Dict, Any, Union, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.data.transforms import AbstractTransform
from virtool.tasks.models import SQLTask
from virtool.types import Document
from virtool.utils import get_safely


class AttachTaskTransform(AbstractTransform):
    """
    Attaches more complete task data to a document with a `task.id` field.
    """

    def __init__(self, pg: AsyncEngine):
        self._pg = pg

    async def attach_one(self, document, prepared):
        return {**document, "task": prepared}

    async def attach_many(
        self, documents: List[Document], prepared: Dict[int, Any]
    ) -> List[Document]:
        attached = []

        for document in documents:
            task_id = get_safely(document, "task", "id")

            attached.append(
                {**document, "task": prepared[task_id] if task_id else None}
            )

        return attached

    async def prepare_one(self, document) -> Optional[Document]:
        task_id = get_safely(document, "task", "id")

        if task_id:
            async with AsyncSession(self._pg) as session:
                result = (
                    await session.execute(select(SQLTask).filter_by(id=task_id))
                ).scalar()

            return result.to_dict()

    async def prepare_many(
        self, documents: List[Document]
    ) -> Dict[Union[int, str], Any]:
        task_ids = {get_safely(document, "task", "id") for document in documents}
        task_ids.discard(None)
        task_ids = list(task_ids)

        async with AsyncSession(self._pg) as session:
            results = await session.execute(
                select(SQLTask).where(SQLTask.id.in_(task_ids))
            )

            return {task.id: task.to_dict() for task in results.scalars()}
