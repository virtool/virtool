"""
Provides request handlers for managing and viewing analyses.

"""
from logging import getLogger
from typing import Union

import arrow
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

from virtool.analyses.models import AnalysisFormat
from virtool.analyses.oas import FindAnalysesResponse, AnalysisResponse
from virtool.api.custom_json import datetime_to_isoformat
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
from virtool.http.routes import Routes
from virtool.http.schema import schema
from virtool.uploads.utils import naive_validator


logger = getLogger("analyses")

routes = Routes()


@routes.view("/analyses")
class AnalysesView(PydanticView):
    async def get(self) -> r200[FindAnalysesResponse]:
        """
        Find analyses.

        Finds analyses based on a search `term`.

        The response will only list analyses on which the user agent has read rights.

        Status Codes:
            200: Successful operation
        """

        search_result = await get_data_from_req(self.request).analyses.find(
            self.request.query,
            self.request["client"],
        )

        return json_response(FindAnalysesResponse.parse_obj(search_result))


@routes.view("/analyses/{analysis_id}")
class AnalysisView(PydanticView):
    async def get(
        self, analysis_id: str, /
    ) -> Union[r200[AnalysisResponse], r400, r403, r404]:
        """
        Get analysis.

        Retrieves the details of an analysis.

        Status Codes:
            200: Successful operation
            400: Parent sample does not exist
            403: Insufficient rights
            404: Not found
        """
        try:
            if not await get_data_from_req(self.request).analyses.has_right(
                analysis_id, self.request["client"], "read"
            ):
                raise InsufficientRights()
        except ResourceError:
            raise HTTPBadRequest(text="Parent sample does not exist")
        except ResourceNotFoundError:
            raise NotFound()

        if_modified_since = self.request.headers.get("If-Modified-Since")

        if if_modified_since is not None:
            if_modified_since = arrow.get(if_modified_since)

        try:
            document = await get_data_from_req(self.request).analyses.get(
                analysis_id,
                if_modified_since,
            )
        except ResourceNotFoundError:
            raise NotFound()
        except ResourceNotModifiedError:
            raise HTTPNotModified()

        headers = {
            "Cache-Control": "no-cache",
            "Last-Modified": datetime_to_isoformat(document.created_at),
        }

        if if_modified_since is not None and (datetime_to_isoformat(if_modified_since.datetime) == headers.get("Last-Modified")):
                raise HTTPNotModified()

        return json_response(document, headers=headers)

    async def delete(self, analysis_id: str, /) -> Union[r204, r403, r404, r409]:
        """
        Delete an analysis.

        Permanently deletes and analysis.

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
                    raise InsufficientRights()
            except ResourceError:
                raise HTTPBadRequest(text="Parent sample does not exist")
            except ResourceNotFoundError:
                raise NotFound()

        try:
            await get_data_from_req(self.request).analyses.delete(analysis_id, False)
        except ResourceNotFoundError:
            raise NotFound()
        except ResourceConflictError:
            raise HTTPConflict(text="Analysis is still running")

        raise HTTPNoContent


@routes.jobs_api.get("/analyses/{analysis_id}")
async def get_for_jobs_api(req: Request) -> Response:
    """
    Get a complete analysis document.

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
        raise NotFound()
    except ResourceNotModifiedError:
        raise HTTPNotModified()
    except ResourceError:
        raise HTTPBadRequest(text="Parent sample does not exist")

    return json_response(
        analysis.dict(by_alias=True),
        headers={
            "Cache-Control": "no-cache",
            "Last-Modified": datetime_to_isoformat(analysis.created_at),
        },
    )


@routes.jobs_api.delete("/analyses/{analysis_id}")
async def delete_analysis(req):

    try:
        await get_data_from_req(req).analyses.delete(
            req.match_info["analysis_id"], True
        )
    except ResourceNotFoundError:
        raise NotFound()
    except ResourceConflictError:
        raise HTTPConflict(text="Analysis is finalized")

    raise HTTPNoContent


@routes.jobs_api.put("/analyses/{id}/files")
async def upload(req: Request) -> Response:
    """
    Upload a new analysis result file to the `analysis_files` SQL table and the
    `analyses` folder in the Virtool data path.

    """
    analysis_id = req.match_info["id"]
    analysis_format = req.query.get("format")

    errors = naive_validator(req)

    if errors:
        raise InvalidQuery(errors)

    name = req.query.get("name")

    if analysis_format and analysis_format not in AnalysisFormat.to_list():
        raise HTTPBadRequest(text="Unsupported analysis file format")

    try:
        analysis_file = await get_data_from_req(req).analyses.upload_file(
            await req.multipart(), analysis_id, analysis_format, name
        )
    except ResourceNotFoundError:
        raise NotFound()

    if analysis_file is None:
        return Response(status=499)

    headers = {"Location": f"/analyses/{analysis_id}/files/{analysis_file.id}"}

    return json_response(analysis_file.to_dict(), status=201, headers=headers)


@routes.view("/analyses/{analysis_id}/files/{upload_id}")
class AnalysisFileView(PydanticView):
    async def get(self, upload_id: int, /) -> Union[r200[FileResponse], r404]:
        """
        Download a file.

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
            raise NotFound()

        analysis_file_path = (
            self.request.app["config"].data_path / "analyses" / name_on_disk
        )

        if not analysis_file_path.exists():
            raise NotFound("Uploaded file not found at expected location")

        return FileResponse(analysis_file_path)


@routes.view("/analyses/documents/{analysis_id}.{extension}")
class DocumentDownloadView(PydanticView):
    async def get(
        self, analysis_id: str, extension: str, /
    ) -> Union[r200[Response], r404]:
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
            raise HTTPBadRequest(text=f"Invalid extension: {extension}")

        try:
            formatted, content_type = await get_data_from_req(
                self.request
            ).analyses.download(analysis_id, extension)
        except ResourceNotFoundError:
            raise NotFound()

        headers = {
            "Content-Disposition": f"attachment; filename={analysis_id}.{extension}",
            "Content-Type": content_type,
        }

        return Response(body=formatted, headers=headers)


@routes.view("/analyses/{analysis_id}/{sequence_index}/blast")
class BlastView(PydanticView):
    async def put(
        self, analysis_id: str, sequence_index: int, /
    ) -> Union[r200[Response], r400, r403, r404, r409]:
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
                raise InsufficientRights()
        except ResourceError:
            raise HTTPBadRequest(text="Parent sample does not exist")
        except ResourceNotFoundError:
            raise NotFound("Analysis not found")

        try:
            document = await get_data_from_req(self.request).analyses.blast(
                analysis_id, sequence_index
            )
        except ResourceConflictError as err:
            raise HTTPConflict(text=str(err))
        except ResourceNotFoundError:
            raise NotFound("Sequence not found")

        headers = {"Location": f"/analyses/{analysis_id}/{sequence_index}/blast"}

        return json_response(document, headers=headers, status=201)


@routes.jobs_api.patch("/analyses/{analysis_id}")
@schema({"results": {"type": "dict", "required": True}})
async def finalize(req: Request):
    """Sets the result for an analysis and marks it as ready."""
    analysis_id = req.match_info["analysis_id"]
    data = await req.json()

    try:
        document = await get_data_from_req(req).analyses.finalize(
            analysis_id, data["results"]
        )
    except ResourceNotFoundError:
        raise NotFound(f"There is no analysis with id {analysis_id}")
    except ResourceConflictError:
        raise HTTPConflict(text="There is already a result for this analysis.")

    return json_response(document)
