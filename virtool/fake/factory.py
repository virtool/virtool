import logging
import shutil
from typing import List

import virtool.indexes.db
import virtool.references.db
import virtool.subtractions.db
import virtool.jobs.db
import virtool.utils
from virtool.jobs.utils import JobRights
from virtool.otus.fake import create_fake_otus
from virtool.analyses.files import create_analysis_file
from virtool.example import example_path
from virtool.fake.wrapper import FakerWrapper
from virtool.hmm.fake import create_fake_hmms
from virtool.indexes.fake import INDEX_FILES
from virtool.indexes.files import create_index_file
from virtool.samples.fake import create_fake_sample
from virtool.subtractions.fake import (create_fake_fasta_upload,
                                       create_fake_finalized_subtraction)
from virtool.fake.identifiers import USER_ID
from virtool.types import App

logger = logging.getLogger(__name__)


class TestCaseDataFactory:
    """Initialize the database with fake data for a test case."""

    def __init__(
            self,
            app: App,
            user_id: str = USER_ID,
            job_id: str = None):
        self.fake = app["fake"] if "fake" in app else FakerWrapper()
        self.user_id = user_id
        self.job_id = job_id or self.fake.get_mongo_id()
        self.app = app
        self.db = app["db"]
        self.pg = app["pg"]
        self.settings = app["settings"]
        self.data_path = self.settings["data_path"]

    async def analysis(
            self,
            index_id: str = None,
            ref_id: str = None,
            subtraction_ids: List[str] = None,
            sample_id: str = None,
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
                analysis_format="fasta",
                name="result.fa",
                size=123456,
            )

            document["files"] = [file_]

        await self.db.analyses.insert_one(document)

        return document

    async def sample(self, paired: bool, finalized: bool) -> dict:
        sample_id = self.fake.get_mongo_id()
        return await create_fake_sample(
            app=self.app,
            sample_id=sample_id,
            user_id=self.user_id,
            paired=paired,
            finalized=finalized,
        )

    async def subtraction(self, finalize=True) -> dict:
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

    async def reference(self) -> dict:
        id_ = self.fake.get_mongo_id()
        document = await virtool.references.db.create_document(
            db=self.db,
            settings=self.settings,
            ref_id=id_,
            name=self.fake.words(1)[0],
            organism="virus",
            description="A fake reference",
            data_type="genome",
            user_id=self.user_id
        )

        await self.db.references.insert_one(document)

        return document

    async def index(self, ref_id: str, finalize: bool = True) -> dict:
        id_ = self.fake.get_mongo_id()
        document = await virtool.indexes.db.create(
            db=self.db,
            ref_id=ref_id,
            user_id=self.user_id,
            job_id=self.job_id,
            index_id=id_,
        )

        path = self.data_path / "references" / ref_id / id_
        example_indexes = example_path / "indexes"
        path.mkdir(parents=True)

        if finalize:
            for index_file in INDEX_FILES:
                shutil.copy(example_indexes / index_file, path)

                await create_index_file(
                    self.pg,
                    id_,
                    "fasta" if index_file == "reference.fa.gz" else "bowtie2",
                    index_file
                )

            document = await virtool.indexes.db.finalize(
                db=self.db,
                pg=self.pg,
                ref_id=ref_id,
                index_id=id_
            )

        return document

    async def hmms(self) -> List[dict]:
        return await create_fake_hmms(self.app)

    async def otus(self, ref_id: str) -> List[dict]:
        return await create_fake_otus(self.app, ref_id, self.user_id)

    async def job(self, workflow: str, args: dict, rights=JobRights()):
        return await virtool.jobs.db.create(
            db=self.db,
            workflow=workflow,
            job_args=args,
            user_id=self.user_id,
            job_id=self.job_id,
            rights=rights,
        )
