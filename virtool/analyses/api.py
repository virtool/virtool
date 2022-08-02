"""
Provides request handlers for managing and viewing analyses.

"""
from asyncio import CancelledError
from logging import getLogger
from typing import Union, List

from aiohttp.web import (
    FileResponse,
    HTTPBadRequest,
    HTTPConflict,
    HTTPNoContent,
    HTTPNotModified,
    Request,
    Response,
)
from aiohttp_pydantic import PydanticView
from aiohttp_pydantic.oas.typing import r200, r204, r400, r403, r404, r409
from sqlalchemy.ext.asyncio.engine import AsyncEngine

import virtool.analyses.format
import virtool.samples.db
import virtool.uploads.db
from virtool.analyses.db import processor
from virtool.analyses.files import create_analysis_file
from virtool.analyses.models import AnalysisFile, AnalysisFormat
from virtool.analyses.utils import attach_analysis_files, find_nuvs_sequence_by_index
from virtool.api.json import isoformat
from virtool.api.response import (
    InsufficientRights,
    InvalidQuery,
    NotFound,
    json_response,
)
from virtool.data.errors import (
    ResourceNotFoundError,
    ResourceNotModifiedError,
    ResourceError,
    ResourceConflictError,
)
from virtool.data.utils import get_data_from_req
from virtool.mongo.core import Collection, DB
from virtool.http.routes import Routes
from virtool.http.schema import schema
from virtool.pg.utils import delete_row, get_row_by_id
from virtool.samples.db import recalculate_workflow_tags
from virtool.samples.utils import get_sample_rights
from virtool.uploads.utils import naive_validator, naive_writer
from virtool.utils import rm, run_in_thread
from virtool_core.models.analysis import AnalysisMinimal, Analysis


logger = getLogger("analyses")

routes = Routes()


@routes.view("/analyses")
class AnalysesView(PydanticView):
    async def get(self) -> r200[List[AnalysisMinimal]]:
        """
        Find and list all analyses.

        Status Codes:
            200: Successful operation
        """
        analysis_documents = await get_data_from_req(self.request).analyses.find(
            self.request
        )

        return json_response(
            {**analysis_documents[0], "documents": analysis_documents[1]}
        )


@routes.view("/analyses/{analysis_id}")
class AnalysisView(PydanticView):
    async def get(self) -> Union[r200[Analysis], r400, r403, r404]:
        """
        Get the details of an analysis.

        Status Codes:
            200: Successful operation
            400: Parent sample does not exist
            403: Insufficient rights
            404: Not found
        """
        try:
            analysis_data = await get_data_from_req(self.request).analyses.get(
                self.request
            )
        except ResourceNotFoundError:
            raise NotFound()
        except ResourceNotModifiedError:
            raise HTTPNotModified()
        except ResourceError:
            raise HTTPBadRequest(text="Parent sample does not exist")
        except InsufficientRights:
            raise InsufficientRights()

        return json_response(analysis_data[0], headers=analysis_data[1])

    async def delete(self) -> Union[r204, r403, r404, r409]:
        """
        Delete an analysis.

        Status Codes:
            204: Successful operation
            403: Insufficient rights
            404: Not found
            409: Analysis is still running
        """
        try:
            await get_data_from_req(self.request).analyses.delete_analysis(self.request)
        except ResourceNotFoundError:
            raise NotFound()
        except ResourceError:
            raise HTTPBadRequest(text="Parent sample does not exist")
        except ResourceConflictError:
            raise HTTPConflict(text="Analysis is still running")
        except InsufficientRights:
            raise InsufficientRights()

        raise HTTPNoContent


@routes.jobs_api.get("/analyses/{analysis_id}")
async def get_for_jobs_api(req: Request) -> Response:
    """
    Get a complete analysis document.

    """
    db = req.app["db"]
    pg = req.app["pg"]

    analysis_id = req.match_info["analysis_id"]

    document = await db.analyses.find_one(analysis_id)

    if document is None:
        raise NotFound()

    try:
        iso = isoformat(document["updated_at"])
    except KeyError:
        iso = isoformat(document["created_at"])

    if_modified_since = req.headers.get("If-Modified-Since")

    if if_modified_since and if_modified_since == iso:
        raise HTTPNotModified()

    document = await attach_analysis_files(pg, analysis_id, document)

    sample = await db.samples.find_one(
        {"_id": document["sample"]["id"]}, {"quality": False}
    )

    if not sample:
        raise HTTPBadRequest(text="Parent sample does not exist")

    if document["ready"]:
        try:
            document = await virtool.analyses.format.format_analysis(req.app, document)
        except ValueError:
            pass

    headers = {
        "Cache-Control": "no-cache",
        "Last-Modified": isoformat(document["created_at"]),
    }

    return json_response(await processor(db, document), headers=headers)


@routes.jobs_api.delete("/analyses/{analysis_id}")
async def delete_analysis(req):
    db = req.app["db"]

    analysis_id = req.match_info["analysis_id"]

    document = await db.analyses.find_one(
        {"_id": analysis_id}, ["job", "ready", "sample"]
    )

    if not document:
        raise NotFound()

    if document["ready"]:
        raise HTTPConflict(text="Analysis is finalized")

    await db.analyses.delete_one({"_id": analysis_id})

    sample_id = document["sample"]["id"]

    path = (
        req.app["config"].data_path / "samples" / sample_id / "analysis" / analysis_id
    )

    try:
        await run_in_thread(rm, path, True)
    except FileNotFoundError:
        pass

    await recalculate_workflow_tags(db, sample_id)

    raise HTTPNoContent


@routes.jobs_api.put("/analyses/{id}/files")
async def upload(req: Request) -> Response:
    """
    Upload a new analysis result file to the `analysis_files` SQL table and the
    `analyses` folder in the Virtool data path.

    """
    db = req.app["db"]
    pg = req.app["pg"]
    analysis_id = req.match_info["id"]
    analysis_format = req.query.get("format")

    document = await db.analyses.find_one(analysis_id)

    if document is None:
        raise NotFound()

    errors = naive_validator(req)

    if errors:
        raise InvalidQuery(errors)

    name = req.query.get("name")

    if analysis_format and analysis_format not in AnalysisFormat.to_list():
        raise HTTPBadRequest(text="Unsupported analysis file format")

    analysis_file = await create_analysis_file(pg, analysis_id, analysis_format, name)

    upload_id = analysis_file["id"]

    analysis_file_path = (
        req.app["config"].data_path / "analyses" / analysis_file["name_on_disk"]
    )

    try:
        size = await naive_writer(req, analysis_file_path)
    except CancelledError:
        logger.debug(f"Analysis file upload aborted: {upload_id}")
        await delete_row(pg, upload_id, AnalysisFile)

        return Response(status=499)

    analysis_file = await virtool.uploads.db.finalize(pg, size, upload_id, AnalysisFile)

    headers = {"Location": f"/analyses/{analysis_id}/files/{upload_id}"}

    return json_response(analysis_file, status=201, headers=headers)


@routes.view("/analyses/{analysis_id}/files/{upload_id}")
class AnalysisFileView(PydanticView):
    async def get(self) -> Union[r200[FileResponse], r404]:
        """
        Download a file generated during the analysis.

        Status Codes:
            200: Successful operation
            404: Not found
        """
        pg = self.request.app["pg"]
        upload_id = int(self.request.match_info["upload_id"])

        analysis_file = await get_row_by_id(pg, AnalysisFile, upload_id)

        if not analysis_file:
            raise NotFound()

        analysis_file_path = (
            self.request.app["config"].data_path
            / "analyses"
            / analysis_file.name_on_disk
        )

        if not analysis_file_path.exists():
            raise NotFound("Uploaded file not found at expected location")

        return FileResponse(analysis_file_path)


@routes.view("/analyses/documents/{analysis_id}.{extension}")
class DocumentDownloadView(PydanticView):
    async def get(self) -> Union[r200[Response], r404]:
        """
        Download an analysis in CSV or XSLX format.

        Status Codes:
            200: Operation successful
            400: Invalid extension
            404: Not found
        """
        db = self.request.app["db"]

        analysis_id = self.request.match_info["analysis_id"]
        extension = self.request.match_info["extension"]

        if extension not in ["xlsx", "csv"]:
            raise HTTPBadRequest(text=f"Invalid extension: {extension}")

        document = await db.analyses.find_one(analysis_id)

        if not document:
            raise NotFound()

        if extension == "xlsx":
            formatted = await virtool.analyses.format.format_analysis_to_excel(
                self.request.app, document
            )
            content_type = (
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            )
        else:
            formatted = await virtool.analyses.format.format_analysis_to_csv(
                self.request.app, document
            )
            content_type = "text/csv"

        headers = {
            "Content-Disposition": f"attachment; filename={analysis_id}.{extension}",
            "Content-Type": content_type,
        }

        return Response(body=formatted, headers=headers)


@routes.view("/analyses/{analysis_id}/{sequence_index}/blast")
class BlastView(PydanticView):
    async def put(self) -> Union[r200[Response], r400, r403, r404, r409]:
        """
        BLAST a contig sequence that is part of a NuVs result record. The resulting
        BLAST data will be attached to that sequence.

        Status Codes:
            200: Operation successful
            400: Parent sample does not exist
            403: Insufficient rights
            404: Analysis not found
            404: Sequence not found
            409: Not a NuVs analysis
            409: Analysis is still running
        """
        db = self.request.app["db"]

        analysis_id = self.request.match_info["analysis_id"]
        sequence_index = int(self.request.match_info["sequence_index"])

        document = await db.analyses.find_one(
            {"_id": analysis_id}, ["ready", "workflow", "results", "sample"]
        )

        if not document:
            raise NotFound("Analysis not found")

        if document["workflow"] != "nuvs":
            raise HTTPConflict(text="Not a NuVs analysis")

        if not document["ready"]:
            raise HTTPConflict(text="Analysis is still running")

        sequence = find_nuvs_sequence_by_index(document, sequence_index)

        if sequence is None:
            raise NotFound("Sequence not found")

        sample = await db.samples.find_one(
            {"_id": document["sample"]["id"]}, virtool.samples.db.PROJECTION
        )

        if not sample:
            raise HTTPBadRequest(text="Parent sample does not exist")

        _, write = get_sample_rights(sample, self.request["client"])

        if not write:
            raise InsufficientRights()

        document = await get_data_from_req(self.request).blast.create_nuvs_blast(
            analysis_id, sequence_index
        )

        headers = {"Location": f"/analyses/{analysis_id}/{sequence_index}/blast"}

        return json_response(document, headers=headers, status=201)


@routes.jobs_api.patch("/analyses/{analysis_id}")
@schema({"results": {"type": "dict", "required": True}})
async def finalize(req: Request):
    """Sets the result for an analysis and marks it as ready."""
    db: DB = req.app["db"]
    pg: AsyncEngine = req.app["pg"]
    analyses: Collection = db.analyses
    analysis_id: str = req.match_info["analysis_id"]

    analysis_document = await analyses.find_one({"_id": analysis_id}, ["ready"])

    if not analysis_document:
        raise NotFound(f"There is no analysis with id {analysis_id}")

    if "ready" in analysis_document and analysis_document["ready"]:
        raise HTTPConflict(text="There is already a result for this analysis.")

    data = await req.json()

    document = await analyses.find_one_and_update(
        {"_id": analysis_id}, {"$set": {"results": data["results"], "ready": True}}
    )

    await recalculate_workflow_tags(db, document["sample"]["id"])
    await attach_analysis_files(pg, analysis_id, document)

    return json_response(await processor(db, document))
