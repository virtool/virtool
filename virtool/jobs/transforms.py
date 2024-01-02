from __future__ import annotations

from typing import TYPE_CHECKING

from virtool.data.transforms import AbstractTransform, apply_transforms
from virtool.types import Document
from virtool.users.transforms import AttachUserTransform
from virtool.utils import get_safely, base_processor

if TYPE_CHECKING:
    from virtool.mongo.core import Mongo

ATTACHED_JOB_PROJECTION = ["archived", "status", "user", "workflow"]


class AttachJobTransform(AbstractTransform):
    def __init__(self, mongo: Mongo):
        self._mongo = mongo

    async def attach_one(self, document: Document, prepared: Document) -> Document:
        return {**document, "job": prepared}

    async def prepare_one(self, document: Document) -> Document | None:
        job_id = get_safely(document, "job", "id")

        if job_id is None:
            return None

        job = await self._mongo.jobs.find_one(job_id, ATTACHED_JOB_PROJECTION)

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

    async def prepare_many(
        self, documents: list[Document]
    ) -> dict[str, Document | None]:
        job_ids = {get_safely(d, "job", "id") for d in documents}

        jobs = [
            base_processor(d)
            async for d in self._mongo.jobs.find(
                {"_id": {"$in": list(job_ids)}}, ATTACHED_JOB_PROJECTION
            )
        ]

        jobs = await apply_transforms(jobs, [AttachUserTransform(self._mongo)])

        jobs_lookup: dict[str | None, dict | None] = {
            job["id"]: {
                **job,
                "created_at": job["status"][0]["timestamp"],
                **{
                    key: job["status"][-1][key]
                    for key in ["progress", "state", "stage"]
                },
            }
            for job in jobs
        }

        jobs_lookup[None] = None

        for job_id in job_ids:
            if job_id not in jobs_lookup:
                jobs_lookup[job_id] = None

        return {d["id"]: jobs_lookup[get_safely(d, "job", "id")] for d in documents}
