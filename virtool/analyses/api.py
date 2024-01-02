"""Request handlers for managing and viewing analyses."""
import asyncio

import arrow
from aiohttp.web import (
    FileResponse,
    HTTPNotModified,
    Request,
    Response,
)
from aiohttp_pydantic import PydanticView
from aiohttp_pydantic.oas.typing import r200, r204, r400, r403, r404, r409
from pydantic import conint

from virtool.analyses.models import AnalysisFormat
from virtool.analyses.oas import FindAnalysesResponse, AnalysisResponse
from virtool.api.custom_json import datetime_to_isoformat, json_response
from virtool.api.errors import (
    APINotFound,
    APIBadRequest,
    APIInsufficientRights,
    APIInvalidQuery,
    APIConflict,
    APINoContent,
)
from virtool.config import get_config_from_req
from virtool.data.errors import (
    ResourceNotFoundError,
    ResourceNotModifiedError,
    ResourceError,
    ResourceConflictError,
)
from virtool.data.utils import get_data_from_req
from virtool.api.routes import Routes
from virtool.api.schema import schema
from virtool.uploads.utils import naive_validator, multipart_file_chunker

routes = Routes()


@routes.view("/analyses")
class AnalysesView(PydanticView):
    async def get(
        self,
        page: conint(ge=1) = 1,
        per_page: conint(ge=1, le=100) = 25,
    ) -> r200[FindAnalysesResponse]:
        """
        Find analyses.

        Lists analyses based on a search `term`.

        The response will only list analyses on which the user agent has read rights.

        Status Codes:
            200: Successful operation
        """

        search_result = await get_data_from_req(self.request).analyses.find(
            page,
            per_page,
            self.request["client"],
        )

        return json_response(FindAnalysesResponse.parse_obj(search_result))


@routes.view("/analyses/{analysis_id}")
class AnalysisView(PydanticView):
    async def get(
        self, analysis_id: str, /
    ) -> r200[AnalysisResponse] | r400 | r403 | r404:
        """
        Get an analysis.

        Fetches the details of an analysis.

        Status Codes:
            200: Successful operation
            304: Not modified
            400: Parent sample does not exist
            403: Insufficient rights
            404: Not found
        """
        try:
            if not await get_data_from_req(self.request).analyses.has_right(
                analysis_id, self.request["client"], "read"
            ):
                raise APIInsufficientRights()
        except ResourceNotFoundError:
            raise APINotFound()

        if_modified_since = self.request.headers.get("If-Modified-Since")

        if if_modified_since:
            if_modified_since = arrow.get(if_modified_since).naive

        try:
            analysis = await get_data_from_req(self.request).analyses.get(
                analysis_id, if_modified_since
            )
        except ResourceNotFoundError:
            raise APINotFound()
        except ResourceNotModifiedError:
            raise HTTPNotModified()

        return json_response(
            analysis,
            headers={
                "Cache-Control": "no-cache",
                "Last-Modified": datetime_to_isoformat(analysis.created_at),
            },
        )

    async def delete(self, analysis_id: str, /) -> r204 | r403 | r404 | r409:
        """
        Delete an analysis.

        Permanently deletes an analysis.

        Status Codes:
            204: Successful operation
            403: Insufficient rights
            404: Not found
            409: Analysis is still running
        """
        for right in ["read", "write"]:
            try:
                if not await get_data_from_req(self.request).analyses.has_right(
                    analysis_id,
                    self.request["client"],
                    right,
                ):
                    raise APIInsufficientRights()
            except ResourceNotFoundError:
                raise APINotFound()

        try:
            await get_data_from_req(self.request).analyses.delete(analysis_id, False)
        except ResourceNotFoundError:
            raise APINotFound()
        except ResourceConflictError:
            raise APIConflict("Analysis is still running")

        raise APINoContent()


@routes.jobs_api.get("/analyses/{analysis_id}")
async def get_for_jobs_api(req: Request) -> Response:
    """
    Get an analysis.

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
    """
    Delete an analysis.

    Deletes an analysis using its 'analysis id'.
    """
    try:
        await get_data_from_req(req).analyses.delete(
            req.match_info["analysis_id"], True
        )
    except ResourceNotFoundError:
        raise APINotFound()
    except ResourceConflictError:
        raise APIConflict("Analysis is finalized")

    raise APINoContent()


@routes.jobs_api.put("/analyses/{id}/files")
@routes.jobs_api.post("/analyses/{id}/files")
async def upload(req: Request) -> Response:
    """
    Upload an analysis file.

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

    print(req)
    print((await req.multipart()).__dict__)
    reader = await req.multipart()
    multipart_file_chunker(reader)
    try:
        analysis_file = await get_data_from_req(req).analyses.upload_file(
            multipart_file_chunker(reader), analysis_id, analysis_format, name
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


@routes.view("/analyses/{analysis_id}/files/{upload_id}")
class AnalysisFileView(PydanticView):
    async def get(self, upload_id: int, /) -> r200[FileResponse] | r404:
        """
        Download an analysis file.

        Downloads a file associated with an analysis. Some workflows retain key files
        after the complete.

        Status Codes:
            200: Successful operation
            404: Not found
        """
        try:
            name_on_disk = await get_data_from_req(self.request).analyses.get_file_name(
                upload_id
            )
        except ResourceNotFoundError:
            raise APINotFound()

        path = get_config_from_req(self.request).data_path / "analyses" / name_on_disk

        if not await asyncio.to_thread(path.exists):
            raise APINotFound()

        return FileResponse(path)


@routes.view("/analyses/documents/{analysis_id}.{extension}")
class DocumentDownloadView(PydanticView):
    async def get(self, analysis_id: str, extension: str, /) -> r200[Response] | r404:
        """
        Download an analysis.

        Downloads analysis data in CSV or XSLX format. The returned format depends on
        the extension included in the request path.

        Status Codes:
            200: Operation successful
            400: Invalid extension
            404: Not found
        """

        if extension not in ["xlsx", "csv"]:
            raise APIBadRequest(f"Invalid extension: {extension}")

        try:
            formatted, content_type = await get_data_from_req(
                self.request
            ).analyses.download(analysis_id, extension)
        except ResourceNotFoundError:
            raise APINotFound()

        return Response(
            body=formatted,
            headers={
                "Content-Disposition": f"attachment; filename={analysis_id}.{extension}",
                "Content-Type": content_type,
            },
        )


@routes.view("/analyses/{analysis_id}/{sequence_index}/blast")
class BlastView(PydanticView):
    async def put(
        self, analysis_id: str, sequence_index: int, /
    ) -> r200[Response] | r400 | r403 | r404 | r409:
        """
        BLAST a NuVs contig.

        BLASTs a sequence that is part of a NuVs result record. The resulting BLAST data
        will be attached to that sequence.

        Status Codes:
            200: Operation successful
            400: Parent sample does not exist
            403: Insufficient rights
            404: Analysis not found
            404: Sequence not found
            409: Not a NuVs analysis
            409: Analysis is still running
        """
        try:
            if not await get_data_from_req(self.request).analyses.has_right(
                analysis_id,
                self.request["client"],
                "write",
            ):
                raise APIInsufficientRights()
        except ResourceNotFoundError:
            raise APINotFound()

        try:
            document = await get_data_from_req(self.request).analyses.blast(
                analysis_id, sequence_index
            )
        except ResourceConflictError as err:
            raise APIConflict(str(err))
        except ResourceNotFoundError:
            raise APINotFound("Sequence not found")

        headers = {"Location": f"/analyses/{analysis_id}/{sequence_index}/blast"}

        return json_response(document, headers=headers, status=201)


@routes.jobs_api.patch("/analyses/{analysis_id}")
@schema({"results": {"type": "dict", "required": True}})
async def finalize(req: Request):
    """
    Finalize an analysis.

    Sets the result for an analysis and marks it as ready.
    """
    analysis_id = req.match_info["analysis_id"]
    data = await req.json()

    try:
        document = await get_data_from_req(req).analyses.finalize(
            analysis_id, data["results"]
        )
    except ResourceNotFoundError:
        raise APINotFound(f"There is no analysis with id {analysis_id}")
    except ResourceConflictError:
        raise APIConflict("There is already a result for this analysis.")

    return json_response(document)
