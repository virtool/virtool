"""
Provides request handlers for managing and viewing analyses.

"""
from asyncio import CancelledError, gather
from logging import getLogger
from typing import Union

import aiojobs.aiohttp
from aiohttp.web import (
    FileResponse,
    HTTPBadRequest,
    HTTPConflict,
    HTTPNoContent,
    HTTPNotModified,
    Request,
    Response,
)
from sqlalchemy.ext.asyncio.engine import AsyncEngine

import virtool.analyses.format
import virtool.bio
import virtool.samples.db
import virtool.uploads.db
from virtool.analyses.db import PROJECTION, processor, update_nuvs_blast
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
from virtool.api.utils import paginate
from virtool.db.core import Collection, DB
from virtool.db.transforms import apply_transforms
from virtool.http.routes import Routes
from virtool.http.schema import schema
from virtool.pg.utils import delete_row, get_row_by_id
from virtool.samples.db import recalculate_workflow_tags
from virtool.samples.utils import get_sample_rights
from virtool.subtractions.db import AttachSubtractionTransform
from virtool.uploads.utils import naive_validator, naive_writer
from virtool.users.db import AttachUserTransform
from virtool.utils import rm

logger = getLogger("analyses")

routes = Routes()


@routes.get("/analyses")
async def find(req: Request) -> Response:
    """
    Find and list all analyses.

    """
    db = req.app["db"]

    db_query = dict()

    data = await paginate(
        db.analyses,
        db_query,
        req.query,
        projection=PROJECTION,
        sort=[("created_at", -1)],
    )

    per_document_can_read = await gather(
        *[
            virtool.samples.db.check_rights(
                db, document["sample"]["id"], req["client"], write=False
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
        documents, [AttachUserTransform(db), AttachSubtractionTransform(db)]
    )

    return json_response({**data, "documents": documents})


@routes.get("/analyses/{analysis_id}")
async def get(req: Request) -> Response:
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

    read, _ = get_sample_rights(sample, req["client"])

    if not read:
        raise InsufficientRights()

    if document["ready"]:
        document = await virtool.analyses.format.format_analysis(req.app, document)

    headers = {
        "Cache-Control": "no-cache",
        "Last-Modified": isoformat(document["created_at"]),
    }

    return json_response(await processor(db, document), headers=headers)


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


@routes.delete("/analyses/{analysis_id}")
async def remove(req: Request) -> Response:
    """
    Remove an analysis document by its id.

    """
    db = req.app["db"]

    analysis_id = req.match_info["analysis_id"]

    document = await db.analyses.find_one(
        {"_id": analysis_id}, ["job", "ready", "sample"]
    )

    if not document:
        raise NotFound()

    sample_id = document["sample"]["id"]

    sample = await db.samples.find_one(
        {"_id": sample_id}, virtool.samples.db.PROJECTION
    )

    if not sample:
        raise HTTPBadRequest(text="Parent sample does not exist")

    read, write = get_sample_rights(sample, req["client"])

    if not read or not write:
        raise InsufficientRights()

    if not document["ready"]:
        raise HTTPConflict(text="Analysis is still running")

    await db.analyses.delete_one({"_id": analysis_id})

    path = (
        req.app["config"].data_path / "samples" / sample_id / "analysis" / analysis_id
    )

    try:
        await req.app["run_in_thread"](rm, path, True)
    except FileNotFoundError:
        pass

    await recalculate_workflow_tags(db, sample_id)

    raise HTTPNoContent


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
        await req.app["run_in_thread"](rm, path, True)
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


@routes.get("/analyses/{analysis_id}/files/{upload_id}")
async def download_analysis_result(req: Request) -> Union[FileResponse, Response]:
    """
    Download an analysis result file.

    """
    pg = req.app["pg"]
    upload_id = int(req.match_info["upload_id"])

    analysis_file = await get_row_by_id(pg, AnalysisFile, upload_id)

    if not analysis_file:
        raise NotFound()

    analysis_file_path = (
        req.app["config"].data_path / "analyses" / analysis_file.name_on_disk
    )

    if not analysis_file_path.exists():
        raise NotFound("Uploaded file not found at expected location")

    return FileResponse(analysis_file_path)


@routes.get("/analyses/documents/{analysis_id}.{extension}")
async def download_analysis_document(req: Request) -> Response:
    """
    Download an analysis document.

    """
    db = req.app["db"]

    analysis_id = req.match_info["analysis_id"]
    extension = req.match_info["extension"]

    document = await db.analyses.find_one(analysis_id)

    if not document:
        raise NotFound()

    if extension == "xlsx":
        formatted = await virtool.analyses.format.format_analysis_to_excel(
            req.app, document
        )
        content_type = (
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
    else:
        formatted = await virtool.analyses.format.format_analysis_to_csv(
            req.app, document
        )
        content_type = "text/csv"

    headers = {
        "Content-Disposition": f"attachment; filename={analysis_id}.{extension}",
        "Content-Type": content_type,
    }

    return Response(body=formatted, headers=headers)


@routes.put("/analyses/{analysis_id}/{sequence_index}/blast")
async def blast(req: Request) -> Response:
    """
    BLAST a contig sequence that is part of a NuVs result record. The resulting BLAST
    data will be attached to that sequence.

    """
    db = req.app["db"]

    analysis_id = req.match_info["analysis_id"]
    sequence_index = int(req.match_info["sequence_index"])

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

    _, write = get_sample_rights(sample, req["client"])

    if not write:
        raise InsufficientRights()

    # Start a BLAST at NCBI with the specified sequence. Return a RID that identifies
    # the BLAST run.
    rid, _ = await virtool.bio.initialize_ncbi_blast(req.app["config"], sequence)

    blast_data, document = await update_nuvs_blast(
        db, req.app["config"], analysis_id, sequence_index, rid
    )

    # Wait on BLAST request as a Task until the it completes on NCBI. At that point the
    # sequence in the DB will be updated with the BLAST result.
    await aiojobs.aiohttp.spawn(
        req,
        virtool.bio.wait_for_blast_result(req.app, analysis_id, sequence_index, rid),
    )

    headers = {"Location": f"/analyses/{analysis_id}/{sequence_index}/blast"}

    return json_response(blast_data, headers=headers, status=201)


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
