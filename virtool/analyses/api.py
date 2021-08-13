"""
Provides request handlers for managing and viewing analyses.

"""
import asyncio
import logging
from typing import Any, Dict, Union

import aiohttp.web
import aiojobs.aiohttp
from aiohttp.web import HTTPNoContent, HTTPBadRequest

import virtool.analyses.format
import virtool.bio
import virtool.http.routes
import virtool.samples.db
from virtool.analyses.db import update_nuvs_blast, PROJECTION
from virtool.analyses.files import create_analysis_file
from virtool.analyses.models import AnalysisFormat, AnalysisFile
from virtool.analyses.utils import attach_analysis_files, find_nuvs_sequence_by_index
from virtool.api.json import isoformat
from virtool.api.response import conflict, insufficient_rights, \
    invalid_query, json_response, not_modified, not_found
from virtool.api.utils import paginate
from virtool.db.core import Collection, DB
from virtool.http.schema import schema
from virtool.pg.utils import delete_row, get_row_by_id
from virtool.samples.db import recalculate_workflow_tags
from virtool.samples.utils import get_sample_rights
from virtool.subtractions.db import attach_subtractions
from virtool.uploads.db import finalize
from virtool.uploads.utils import naive_writer, naive_validator
from virtool.utils import base_processor, rm

logger = logging.getLogger("analyses")

routes = virtool.http.routes.Routes()


@routes.get("/api/analyses")
async def find(req: aiohttp.web.Request) -> aiohttp.web.Response:
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
        sort=[("created_at", -1)]
    )

    checked_documents = []
    for document in data["documents"]:
        if await virtool.samples.db.check_rights(
                db,
                document["sample"]["id"],
                req["client"],
                write=False
        ):
            checked_documents.append(document)

    data["documents"] = await asyncio.tasks.gather(
        *[attach_subtractions(db, d) for d in checked_documents])

    return json_response(data)


@routes.get("/api/analyses/{analysis_id}")
async def get(req: aiohttp.web.Request) -> aiohttp.web.Response:
    """
    Get a complete analysis document.

    """
    db = req.app["db"]
    pg = req.app["pg"]

    analysis_id = req.match_info["analysis_id"]

    document = await db.analyses.find_one(analysis_id)

    if document is None:
        return not_found()

    try:
        iso = isoformat(document["updated_at"])
    except KeyError:
        iso = isoformat(document["created_at"])

    if_modified_since = req.headers.get("If-Modified-Since")

    if if_modified_since and if_modified_since == iso:
        return not_modified()

    document = await attach_analysis_files(pg, analysis_id, document)

    sample = await db.samples.find_one(
        {"_id": document["sample"]["id"]},
        {"quality": False}
    )

    if not sample:
        raise HTTPBadRequest(text="Parent sample does not exist")

    read, _ = get_sample_rights(sample, req["client"])

    if not read:
        return insufficient_rights()

    document = await attach_subtractions(db, document)

    if document["ready"]:
        document = await virtool.analyses.format.format_analysis(req.app, document)

    headers = {
        "Cache-Control": "no-cache",
        "Last-Modified": isoformat(document["created_at"])
    }

    return json_response(base_processor(document), headers=headers)


@routes.jobs_api.get("/api/analyses/{analysis_id}")
async def get_for_jobs_api(req: aiohttp.web.Request) -> aiohttp.web.Response:
    """
    Get a complete analysis document.

    """
    db = req.app["db"]
    pg = req.app["pg"]

    analysis_id = req.match_info["analysis_id"]

    document = await db.analyses.find_one(analysis_id)

    if document is None:
        return not_found()

    try:
        iso = isoformat(document["updated_at"])
    except KeyError:
        iso = isoformat(document["created_at"])

    if_modified_since = req.headers.get("If-Modified-Since")

    if if_modified_since and if_modified_since == iso:
        return not_modified()

    document = await attach_analysis_files(pg, analysis_id, document)

    sample = await db.samples.find_one(
        {"_id": document["sample"]["id"]},
        {"quality": False}
    )

    if not sample:
        raise HTTPBadRequest(text="Parent sample does not exist")

    document = await attach_subtractions(db, document)

    if document["ready"]:
        try:
            document = await virtool.analyses.format.format_analysis(req.app, document)
        except ValueError:
            pass

    headers = {
        "Cache-Control": "no-cache",
        "Last-Modified": isoformat(document["created_at"])
    }

    return json_response(base_processor(document), headers=headers)


@routes.delete("/api/analyses/{analysis_id}")
async def remove(req: aiohttp.web.Request) -> aiohttp.web.Response:
    """
    Remove an analysis document by its id.

    """
    db = req.app["db"]

    analysis_id = req.match_info["analysis_id"]

    document = await db.analyses.find_one(
        {"_id": analysis_id},
        ["job", "ready", "sample"]
    )

    if not document:
        return not_found()

    sample_id = document["sample"]["id"]

    sample = await db.samples.find_one(
        {"_id": sample_id},
        virtool.samples.db.PROJECTION
    )

    if not sample:
        raise HTTPBadRequest(text="Parent sample does not exist")

    read, write = get_sample_rights(sample, req["client"])

    if not read or not write:
        return insufficient_rights()

    if not document["ready"]:
        return conflict("Analysis is still running")

    await db.analyses.delete_one({"_id": analysis_id})

    path = (
            req.app["settings"]["data_path"]
            / "samples"
            / sample_id
            / "analysis"
            / analysis_id
    )

    try:
        await req.app["run_in_thread"](rm, path, True)
    except FileNotFoundError:
        pass

    await virtool.samples.db.recalculate_workflow_tags(db, sample_id)

    raise HTTPNoContent


@routes.jobs_api.delete("/api/analyses/{analysis_id}")
async def delete_analysis(req):
    db = req.app["db"]

    analysis_id = req.match_info["analysis_id"]

    document = await db.analyses.find_one(
        {"_id": analysis_id},
        ["job", "ready", "sample"]
    )

    if not document:
        return not_found()

    if document["ready"]:
        return conflict("Analysis is finalized")

    await db.analyses.delete_one({"_id": analysis_id})

    sample_id = document["sample"]["id"]

    path = (
            req.app["settings"]["data_path"]
            / "samples"
            / sample_id
            / "analysis"
            / analysis_id
    )

    try:
        await req.app["run_in_thread"](rm, path, True)
    except FileNotFoundError:
        pass

    await virtool.samples.db.recalculate_workflow_tags(db, sample_id)

    raise HTTPNoContent


@routes.jobs_api.put("/api/analyses/{id}/files")
async def upload(req: aiohttp.web.Request) -> aiohttp.web.Response:
    """
    Upload a new analysis result file to the `analysis_files` SQL table and the `analyses` folder in the Virtool
    data path.

    """
    db = req.app["db"]
    pg = req.app["pg"]
    analysis_id = req.match_info["id"]
    analysis_format = req.query.get("format")

    document = await db.analyses.find_one(analysis_id)

    if document is None:
        return not_found()

    errors = naive_validator(req)

    if errors:
        return invalid_query(errors)

    name = req.query.get("name")

    if analysis_format and analysis_format not in AnalysisFormat.to_list():
        raise HTTPBadRequest(text="Unsupported analysis file format")

    analysis_file = await create_analysis_file(pg, analysis_id, analysis_format, name)

    upload_id = analysis_file["id"]

    analysis_file_path = req.app["settings"]["data_path"] / "analyses" / analysis_file["name_on_disk"]

    try:
        size = await naive_writer(req, analysis_file_path)
    except asyncio.CancelledError:
        logger.debug(f"Analysis file upload aborted: {upload_id}")
        await delete_row(pg, upload_id, AnalysisFile)

        return aiohttp.web.Response(status=499)

    analysis_file = await finalize(pg, size, upload_id, AnalysisFile)

    headers = {
        "Location": f"/api/analyses/{analysis_id}/files/{upload_id}"
    }

    return json_response(analysis_file, status=201, headers=headers)


@routes.get("/api/analyses/{analysis_id}/files/{upload_id}")
async def download_analysis_result(req: aiohttp.web.Request) -> Union[aiohttp.web.FileResponse, aiohttp.web.Response]:
    """
    Download an analysis result file.

    """
    pg = req.app["pg"]
    upload_id = int(req.match_info["upload_id"])

    analysis_file = await get_row_by_id(pg, AnalysisFile, upload_id)

    if not analysis_file:
        return not_found()

    analysis_file_path = req.app["settings"]["data_path"] / "analyses" / analysis_file.name_on_disk

    if not analysis_file_path.exists():
        return not_found("Uploaded file not found at expected location")

    return aiohttp.web.FileResponse(analysis_file_path)


@routes.get("/api/analyses/documents/{analysis_id}.{extension}")
async def download_analysis_document(req: aiohttp.web.Request) -> aiohttp.web.Response:
    """
    Download an analysis document.

    """
    db = req.app["db"]

    analysis_id = req.match_info["analysis_id"]
    extension = req.match_info["extension"]

    document = await db.analyses.find_one(analysis_id)

    if not document:
        return not_found()

    if extension == "xlsx":
        formatted = await virtool.analyses.format.format_analysis_to_excel(req.app, document)
        content_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    else:
        formatted = await virtool.analyses.format.format_analysis_to_csv(req.app, document)
        content_type = "text/csv"

    headers = {
        "Content-Disposition": f"attachment; filename={analysis_id}.{extension}",
        "Content-Type": content_type
    }

    return aiohttp.web.Response(text=formatted, headers=headers)


@routes.put("/api/analyses/{analysis_id}/{sequence_index}/blast")
async def blast(req: aiohttp.web.Request) -> aiohttp.web.Response:
    """
    BLAST a contig sequence that is part of a NuVs result record. The resulting BLAST
    data will be attached to that sequence.

    """
    db = req.app["db"]
    settings = req.app["settings"]

    analysis_id = req.match_info["analysis_id"]
    sequence_index = int(req.match_info["sequence_index"])

    document = await db.analyses.find_one(
        {"_id": analysis_id},
        ["ready", "workflow", "results", "sample"]
    )

    if not document:
        return not_found("Analysis not found")

    if document["workflow"] != "nuvs":
        return conflict("Not a NuVs analysis")

    if not document["ready"]:
        return conflict("Analysis is still running")

    sequence = find_nuvs_sequence_by_index(document, sequence_index)

    if sequence is None:
        return not_found("Sequence not found")

    sample = await db.samples.find_one(
        {"_id": document["sample"]["id"]},
        virtool.samples.db.PROJECTION
    )

    if not sample:
        raise HTTPBadRequest(text="Parent sample does not exist")

    _, write = get_sample_rights(sample, req["client"])

    if not write:
        return insufficient_rights()

    # Start a BLAST at NCBI with the specified sequence. Return a RID that identifies
    # the BLAST run.
    rid, _ = await virtool.bio.initialize_ncbi_blast(req.app["settings"], sequence)

    blast_data, document = await update_nuvs_blast(
        db,
        settings,
        analysis_id,
        sequence_index,
        rid
    )

    # Wait on BLAST request as a Task until the it completes on NCBI. At that point the
    # sequence in the DB will be updated with the BLAST result.
    await aiojobs.aiohttp.spawn(req, virtool.bio.wait_for_blast_result(
        req.app,
        analysis_id,
        sequence_index,
        rid
    ))

    headers = {
        "Location": f"/api/analyses/{analysis_id}/{sequence_index}/blast"
    }

    return json_response(blast_data, headers=headers, status=201)


@routes.jobs_api.patch("/api/analyses/{analysis_id}")
@schema({"results": {"type": "dict", "required": True}})
async def patch_analysis(req: aiohttp.web.Request):
    """Sets the result for an analysis and marks it as ready."""
    db: DB = req.app["db"]
    analyses: Collection = db.analyses
    analysis_id: str = req.match_info["analysis_id"]

    analysis_document: Dict[str, Any] = await analyses.find_one({"_id": analysis_id})

    if not analysis_document:
        return not_found(f"There is no analysis with id {analysis_id}")

    if "ready" in analysis_document and analysis_document["ready"]:
        return conflict("There is already a result for this analysis.")

    request_json = await req.json()

    updated_analysis_document = await analyses.find_one_and_update({"_id": analysis_id}, {
        "$set": {
            "results": request_json["results"],
            "ready": True
        }
    })

    await recalculate_workflow_tags(db, analysis_document["sample"]["id"])

    return json_response(base_processor(updated_analysis_document))
