from __future__ import annotations

from typing import TYPE_CHECKING

from virtool.data.transforms import AbstractTransform, apply_transforms
from virtool.types import Document
from virtool.users.transforms import AttachUserTransform
from virtool.utils import get_safely, base_processor

if TYPE_CHECKING:
    from virtool.mongo.core import Mongo


class AttachJobTransform(AbstractTransform):
    def __init__(self, mongo: Mongo):
        self._mongo = mongo

    async def prepare_one(self, document: Document) -> Document | None:
        job_id = get_safely(document, "job", "id")

        if job_id is None:
            return None

        job = await self._mongo.jobs.find_one(
            job_id, ["archived", "status", "user", "workflow"]
        )

        if job is None:
            return None

        last_status = job["status"][-1]

        return await apply_transforms(
            base_processor(
                {
                    **job,
                    "created_at": job["status"][0]["timestamp"],
                    "progress": last_status["progress"],
                    "state": last_status["state"],
                    "stage": last_status["stage"],
                }
            ),
            [AttachUserTransform(self._mongo)],
        )

    async def attach_one(self, document: Document, prepared: Document) -> Document:
        return {**document, "job": prepared}
