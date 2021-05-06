import logging
from typing import List

import virtool.utils
import virtool.subtractions.db
from virtool.analyses.files import create_analysis_file
from virtool.fake.wrapper import FakerWrapper
from virtool.samples.fake import create_fake_sample
from virtool.subtractions.fake import (
        create_fake_fasta_upload,
        create_fake_finalized_subtraction
)
from virtool.types import App

logger = logging.getLogger(__name__)


class TestCaseDataFactory:
    """Initialize the database with fake data for a test case."""

    def __init__(self, app: App, user_id: str, job_id: str = None):
        self.fake = FakerWrapper()
        self.user_id = user_id
        self.job_id = job_id or self.fake.get_mongo_id()
        self.app = app
        self.db = app["db"]
        self.pg = app["pg"]

    async def analysis(
            self,
            index_id: str,
            ref_id: str,
            subtraction_ids: List[str],
            sample_id: str,
            workflow: str = "test",
            ready=False
    ):
        id_ = self.fake.get_mongo_id()

        document = {
            "_id": id_,
            "workflow": workflow,
            "created_at": virtool.utils.timestamp(),
            "ready": ready,
            "job": {
                "id": self.job_id
            },
            "index": {
                "id": index_id
            },
            "user": {
                "id": self.user_id
            },
            "sample": {
                "id": sample_id
            },
            "reference": {
                "id": ref_id
            },
            "subtractions": subtraction_ids,
        }

        if ready:
            file_ = await create_analysis_file(
                pg=self.pg,
                analysis_id=id_,
                format="fasta",
                name="result.fa",
                size=123456,
            )

            document["files"] = [file_]

        await self.db.analyses.insert_one(document)

        return document

    async def sample(self, paired: bool, finalized: bool) -> dict:
        return await create_fake_sample(
            sample_id=self.fake.get_mongo_id(),
            user_id=self.user_id,
            paired=paired,
            finalized=finalized,
        )

    async def subtraction(self, finalize=True):
        id_ = self.fake.get_mongo_id()
        upload_id, upload_name = await create_fake_fasta_upload(
                self.app,
                self.user_id
        )

        if finalize:
            return await create_fake_finalized_subtraction(
                app=self.app,
                upload_id=upload_id,
                upload_name=upload_name,
                subtraction_id=id_,
                user_id=self.user_id,
            )

        return await virtool.subtractions.db.create(
            db=self.db,
            user_id=self.user_id,
            upload_id=upload_id,
            name=upload_name,
            nickname="",
            filename=upload_name,
            subtraction_id=id_,
        )
