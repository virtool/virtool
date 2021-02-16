"""
Provides request handlers for managing and viewing analyses.

"""
import asyncio
import logging
import os
from pathlib import Path
from typing import Any, Dict, Union

import aiohttp.web
import aiojobs.aiohttp

import virtool.analyses.db
import virtool.analyses.format
import virtool.analyses.utils
import virtool.api.json
import virtool.api.response
import virtool.api.utils
import virtool.bio
import virtool.errors
import virtool.http.routes
import virtool.samples.db
import virtool.samples.utils
import virtool.subtractions.db
import virtool.uploads.db
import virtool.uploads.utils
import virtool.utils
import virtool.validators
from virtool.analyses.models import ANALYSIS_FORMATS, AnalysisFile
from virtool.api.response import bad_request, conflict, insufficient_rights, \
    invalid_query, json_response, no_content, not_found
from virtool.db.core import Collection, DB
from virtool.samples.db import recalculate_workflow_tags
from virtool.utils import base_processor

logger = logging.getLogger("analyses")

routes = virtool.http.routes.Routes()


@routes.get("/api/analyses")
async def find(req: aiohttp.web.Request) -> aiohttp.web.Response:
    """
    Find and list all analyses.

    """
    db = req.app["db"]

    db_query = dict()

    data = await virtool.api.utils.paginate(
        db.analyses,
        db_query,
        req.query,
        projection=virtool.analyses.db.PROJECTION,
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

    data["documents"] = checked_documents

    await asyncio.tasks.gather(
        *[virtool.subtractions.db.attach_subtraction(db, d) for d in data["documents"]])

    return json_response(data)


@routes.get("/api/analyses/{analysis_id}", allow_jobs=True)
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
        iso = virtool.api.json.isoformat(document["updated_at"])
    except KeyError:
        iso = virtool.api.json.isoformat(document["created_at"])

    if_modified_since = req.headers.get("If-Modified-Since")

    if if_modified_since and if_modified_since == iso:
        return virtool.api.response.not_modified()

    if document.get("files"):
        document["files"] = await virtool.analyses.utils.attach_analysis_files(pg, analysis_id)

    sample = await db.samples.find_one(
        {"_id": document["sample"]["id"]},
        {"quality": False}
    )

    if not sample:
        return bad_request("Parent sample does not exist")

    read, _ = virtool.samples.utils.get_sample_rights(sample, req["client"])

    if not read:
        return insufficient_rights()

    await virtool.subtractions.db.attach_subtraction(db, document)

    if document["ready"]:
        document = await virtool.analyses.format.format_analysis(req.app, document)

    headers = {
        "Cache-Control": "no-cache",
        "Last-Modified": virtool.api.json.isoformat(document["created_at"])
    }

    return json_response(virtool.utils.base_processor(document), headers=headers)


@routes.delete("/api/analyses/{analysis_id}", allow_jobs=True)
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
        return bad_request("Parent sample does not exist")

    read, write = virtool.samples.utils.get_sample_rights(sample, req["client"])

    if not read or not write:
        return insufficient_rights()

    if not document["ready"]:
        return conflict("Analysis is still running")

    await db.analyses.delete_one({"_id": analysis_id})

    path = os.path.join(
        req.app["settings"]["data_path"],
        "samples",
        sample_id,
        "analysis",
        analysis_id
    )

    try:
        await req.app["run_in_thread"](virtool.utils.rm, path, True)
    except FileNotFoundError:
        pass

    await virtool.samples.db.recalculate_workflow_tags(db, sample_id)

    return no_content()


@routes.post("/api/analyses/{id}/files")
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

    errors = virtool.uploads.utils.naive_validator(req)

    if errors:
        return invalid_query(errors)

    name = req.query.get("name")

    if analysis_format not in ANALYSIS_FORMATS:
        return bad_request("Unsupported analysis file format")

    analysis_file = await virtool.analyses.db.create_row(pg, analysis_id, analysis_format, name)

    name_on_disk = analysis_file["name_on_disk"]
    files = document.get("files", [])

    if name_on_disk in files:
        return bad_request("File is already associated with analysis")

    file_id = analysis_file["id"]
    analysis_file_path = Path(req.app["settings"]["data_path"]) / "analyses" / name_on_disk

    try:
        size = await virtool.uploads.utils.naive_writer(req, analysis_file_path)
    except asyncio.CancelledError:
        logger.debug(f"Upload aborted: {file_id}")
        await virtool.analyses.db.delete_row(pg, file_id)

        return aiohttp.web.Response(status=499)

    analysis_file = await virtool.uploads.db.finalize(pg, size, file_id, AnalysisFile)

    if not analysis_file:
        await req.app["run_in_thread"](os.remove, analysis_file_path)
        return not_found("Row not found in table after file upload")

    files.append(name_on_disk)

    await db.analyses.update_one({"_id": analysis_id}, {
        "$set": {"files": files}
    })

    headers = {
        "Location": f"/api/analyses/{analysis_id}/files/{file_id}"
    }

    return json_response(analysis_file, status=201, headers=headers)


@routes.get("/api/analyses/{analysis_id}/files/{file_id}")
async def download(req: aiohttp.web.Request) -> Union[aiohttp.web.FileResponse, aiohttp.web.Response]:
    """
    Download an analysis result file.

    """
    pg = req.app["pg"]
    file_id = int(req.match_info["file_id"])

    analysis_file = await virtool.analyses.db.get_row(pg, file_id)

    if not analysis_file:
        return not_found()

    analysis_file_path = Path(req.app["settings"]["data_path"]) / "analyses" / analysis_file.name_on_disk

    if not analysis_file_path.exists():
        return not_found("Uploaded file not found at expected location")

    return aiohttp.web.FileResponse(analysis_file_path)


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

    sequence = virtool.analyses.utils.find_nuvs_sequence_by_index(document,
                                                                  sequence_index)

    if sequence is None:
        return not_found("Sequence not found")

    sample = await db.samples.find_one(
        {"_id": document["sample"]["id"]},
        virtool.samples.db.PROJECTION
    )

    if not sample:
        return bad_request("Parent sample does not exist")

    _, write = virtool.samples.utils.get_sample_rights(sample, req["client"])

    if not write:
        return insufficient_rights()

    # Start a BLAST at NCBI with the specified sequence. Return a RID that identifies
    # the BLAST run.
    rid, _ = await virtool.bio.initialize_ncbi_blast(req.app["settings"], sequence)

    blast_data, document = await virtool.analyses.db.update_nuvs_blast(
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


@routes.patch("/api/analyses/{analysis_id}", schema={
    "results": {"type": "dict", "required": True}
})
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
