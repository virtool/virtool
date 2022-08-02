from asyncio import gather
from typing import List, Union

from aiohttp.web_request import Request
from sqlalchemy.ext.asyncio import AsyncEngine
from virtool_core.models.samples import Sample
from virtool_core.models.analysis import AnalysisMinimal

import virtool.samples.db
import virtool.analyses.format
from virtool.analyses.db import PROJECTION, processor
from virtool.analyses.utils import attach_analysis_files
from virtool.api.json import isoformat
from virtool.api.response import InsufficientRights
from virtool.api.utils import paginate
from virtool.blast.transform import AttachNuVsBLAST
from virtool.data.errors import (
    ResourceNotFoundError,
    ResourceNotModifiedError,
    ResourceError,
    ResourceConflictError,
)
from virtool.mongo.core import DB
from virtool.mongo.transforms import apply_transforms
from virtool.samples.utils import get_sample_rights
from virtool.subtractions.db import AttachSubtractionTransform

from virtool.users.db import AttachUserTransform
from virtool.utils import run_in_thread, rm
from virtool.samples.db import recalculate_workflow_tags


class AnalysisData:
    def __init__(self, db: DB, pg: AsyncEngine):
        self._db = db
        self._pg = pg

    async def find(self, request: Request) -> List[Union[dict, List[AnalysisMinimal]]]:
        """
        List all analysis documents.
        """
        db_query = {}

        data = await paginate(
            self._db.analyses,
            db_query,
            request.query,
            projection=PROJECTION,
            sort=[("created_at", -1)],
        )

        per_document_can_read = await gather(
            *[
                virtool.samples.db.check_rights(
                    self._db, document["sample"]["id"], request["client"], write=False
                )
                for document in data["documents"]
            ]
        )

        documents = [
            document
            for document, can_write in zip(data["documents"], per_document_can_read)
            if can_write
        ]

        documents = await apply_transforms(
            documents,
            [AttachUserTransform(self._db), AttachSubtractionTransform(self._db)],
        )

        return [data, documents]

    async def get(self, request: Request) -> List[Union[dict, Sample]]:
        """
        Get a single analysis by its ID.
        """
        analysis_id = request.match_info["analysis_id"]

        document = await self._db.analyses.find_one(analysis_id)

        if document is None:
            raise ResourceNotFoundError()

        try:
            iso = isoformat(document["updated_at"])
        except KeyError:
            iso = isoformat(document["created_at"])

        if_modified_since = request.headers.get("If-Modified-Since")

        if if_modified_since and if_modified_since == iso:
            raise ResourceNotModifiedError()

        document = await attach_analysis_files(self._pg, analysis_id, document)

        sample = await self._db.samples.find_one(
            {"_id": document["sample"]["id"]}, {"quality": False}
        )

        if not sample:
            raise ResourceError()

        read, _ = get_sample_rights(sample, request["client"])

        if not read:
            raise InsufficientRights()

        if document["ready"]:
            document = await virtool.analyses.format.format_analysis(
                request.app, document
            )

        headers = {
            "Cache-Control": "no-cache",
            "Last-Modified": isoformat(document["created_at"]),
        }

        document = await processor(self._db, document)

        if document["workflow"] == "nuvs":
            document = await apply_transforms(
                document,
                [AttachNuVsBLAST(self._pg)],
            )

        return [document, headers]

    async def delete_analysis(self, request: Request):
        """
        Delete a single analysis by its ID.
        """
        analysis_id = request.match_info["analysis_id"]

        document = await self._db.analyses.find_one(
            {"_id": analysis_id}, ["job", "ready", "sample"]
        )

        if not document:
            raise ResourceNotFoundError()

        sample_id = document["sample"]["id"]

        sample = await self._db.samples.find_one(
            {"_id": sample_id}, virtool.samples.db.PROJECTION
        )

        if not sample:
            raise ResourceError()

        read, write = get_sample_rights(sample, request["client"])

        if not read or not write:
            raise InsufficientRights()

        if not document["ready"]:
            raise ResourceConflictError()

        await self._db.analyses.delete_one({"_id": analysis_id})

        path = (
            request.app["config"].data_path
            / "samples"
            / sample_id
            / "analysis"
            / analysis_id
        )

        try:
            await run_in_thread(rm, path, True)
        except FileNotFoundError:
            pass

        await recalculate_workflow_tags(self._db, sample_id)

    async def get_jobs_api(self):
        """
        Get a single analysis document by its ID through Jobs API.
        """
