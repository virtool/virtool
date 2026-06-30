from typing import TYPE_CHECKING

from sqlalchemy.ext.asyncio import AsyncSession

from virtool.data.transforms import AbstractTransform
from virtool.types import Document
from virtool.utils import get_safely

if TYPE_CHECKING:
    from virtool.mongo.core import Mongo


PROJECTION = ["_id", "version"]


def attach_index_build(document: Document) -> Document:
    """Attach the UI-facing index build summary to an index document."""
    return {**document, "build": compose_index_build(document)}


def attach_index_builds(documents: list[Document]) -> list[Document]:
    """Attach UI-facing build summaries to index documents."""
    return [attach_index_build(document) for document in documents]


def compose_index_build(document: Document) -> Document | None:
    task = document["task"]

    if task:
        return {
            "progress": task["progress"],
            "status": _compose_task_status(task),
        }

    job = document["job"]

    if job:
        return {
            "progress": job["progress"],
            "status": job["state"],
        }

    return None


def _compose_task_status(task: Document) -> str:
    if task["error"]:
        return "failed"

    if task["complete"]:
        return "succeeded"

    if task["acquired_at"] or task["progress"] > 0:
        return "running"

    return "pending"


class AttachIndexTransform(AbstractTransform):
    """Attach a nested ``{id, version}`` to documents with an ``index.id`` field.

    The index version is not stored in Postgres, so it is looked up from the Mongo
    ``indexes`` collection at read time.
    """

    def __init__(self, mongo: "Mongo"):
        self._mongo = mongo

    async def attach_one(self, document: Document, prepared: Document) -> Document:
        return {**document, "index": prepared}

    async def prepare_one(self, document: Document, session: AsyncSession) -> Document:
        index_id = get_safely(document, "index", "id")

        if index_id is None:
            raise ValueError("Missing index id")

        index = await self._mongo.indexes.find_one({"_id": index_id}, PROJECTION)

        if index is None:
            raise ValueError(f"Index not found: {index_id}")

        return {"id": index_id, "version": index["version"]}

    async def prepare_many(
        self,
        documents: list[Document],
        session: AsyncSession,
    ) -> dict[str, Document]:
        index_ids = {get_safely(d, "index", "id") for d in documents}

        if None in index_ids:
            raise ValueError("Missing index id")

        version_lookup = {
            index["_id"]: index["version"]
            async for index in self._mongo.indexes.find(
                {"_id": {"$in": list(index_ids)}},
                PROJECTION,
            )
        }

        missing = index_ids - version_lookup.keys()

        if missing:
            raise ValueError(f"Indexes not found: {sorted(missing)}")

        return {
            d["id"]: {
                "id": d["index"]["id"],
                "version": version_lookup[d["index"]["id"]],
            }
            for d in documents
        }
