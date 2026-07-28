"""Request handlers for managing and viewing analyses."""

import arrow
from aiohttp.web import (
    HTTPNotModified,
    Request,
    Response,
)

from virtool.analyses.sql import AnalysisFormat
from virtool.api.custom_json import datetime_to_isoformat, json_response
from virtool.api.errors import (
    APIBadRequest,
    APIConflict,
    APIInvalidQuery,
    APINoContent,
    APINotFound,
)
from virtool.api.routes import Routes
from virtool.api.schema import schema
from virtool.data.errors import (
    ResourceConflictError,
    ResourceError,
    ResourceNotFoundError,
    ResourceNotModifiedError,
)
from virtool.data.utils import get_data_from_req
from virtool.uploads.utils import multipart_file_chunker, naive_validator

routes = Routes()


@routes.jobs_api.get("/analyses/{analysis_id}")
async def get_for_jobs_api(req: Request) -> Response:
    """Get an analysis.

    Fetches the complete analysis document.

    """
    if_modified_since = req.headers.get("If-Modified-Since")

    if if_modified_since is not None:
        if_modified_since = arrow.get(if_modified_since)

    try:
        analysis = await get_data_from_req(req).analyses.get(
            req.match_info["analysis_id"],
            if_modified_since,
        )
    except ResourceNotFoundError:
        raise APINotFound()
    except ResourceNotModifiedError:
        raise HTTPNotModified()
    except ResourceError:
        raise APIBadRequest("Parent sample does not exist")

    return json_response(
        analysis.dict(by_alias=True),
        headers={
            "Cache-Control": "no-cache",
            "Last-Modified": datetime_to_isoformat(analysis.created_at),
        },
    )


@routes.jobs_api.delete("/analyses/{analysis_id}")
async def delete_analysis(req):
    """Delete an analysis.

    Deletes an analysis using its 'analysis id'.
    """
    try:
        await get_data_from_req(req).analyses.delete(
            req.match_info["analysis_id"],
            True,
        )
    except ResourceNotFoundError:
        raise APINotFound()
    except ResourceConflictError:
        raise APIConflict("Analysis is finalized")

    raise APINoContent()


@routes.jobs_api.put("/analyses/{id}/files")
@routes.jobs_api.post("/analyses/{id}/files")
async def upload(req: Request) -> Response:
    """Upload an analysis file.

    Uploads a new analysis result file to the `analysis_files` SQL table and the
    `analyses` folder in the Virtool data path.
    TODO: Remove deprecated PUT method handler.

    """
    analysis_id = req.match_info["id"]
    analysis_format = req.query.get("format")

    errors = naive_validator(req)

    if errors:
        raise APIInvalidQuery(errors)

    name = req.query.get("name")

    if analysis_format and analysis_format not in AnalysisFormat.to_list():
        raise APIBadRequest("Unsupported analysis file format")

    reader = await req.multipart()

    try:
        analysis_file = await get_data_from_req(req).analyses.upload_file(
            multipart_file_chunker(reader),
            analysis_id,
            analysis_format,
            name,
        )
    except ResourceNotFoundError:
        raise APINotFound()

    if analysis_file is None:
        return Response(status=499)

    return json_response(
        analysis_file.dict(),
        status=201,
        headers={"Location": f"/analyses/{analysis_id}/files/{analysis_file.id}"},
    )


@routes.jobs_api.patch("/analyses/{analysis_id}")
@schema({"results": {"type": "dict", "required": True}})
async def finalize(req: Request):
    """Finalize an analysis.

    Sets the result for an analysis and marks it as ready.
    """
    analysis_id = req.match_info["analysis_id"]
    data = await req.json()

    try:
        document = await get_data_from_req(req).analyses.finalize(
            analysis_id,
            data["results"],
        )
    except ResourceNotFoundError:
        raise APINotFound(f"There is no analysis with id {analysis_id}")
    except ResourceConflictError:
        raise APIConflict("There is already a result for this analysis.")

    return json_response(document)
