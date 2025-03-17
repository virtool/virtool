"""Request handlers for managing and viewing analyses."""

import asyncio

import arrow
from aiohttp.web import (
    FileResponse,
    HTTPNotModified,
    Response,
)
from pydantic import Field
from virtool_core.utils import file_stats

from virtool.analyses.models import AnalysisFormat
from virtool.analyses.oas import (
    AnalysesSearchResponse,
    AnalysisFinalizeRequest,
    AnalysisResponse,
)
from virtool.api.custom_json import datetime_to_isoformat, json_response
from virtool.api.errors import (
    APIBadRequest,
    APIConflict,
    APIInsufficientRights,
    APINoContent,
    APINotFound,
)
from virtool.api.routes import Routes
from virtool.api.status import R200, R201, R204, R400, R403, R404, R409
from virtool.api.view import APIView
from virtool.config import get_config_from_req
from virtool.data.errors import (
    ResourceConflictError,
    ResourceNotFoundError,
    ResourceNotModifiedError,
)
from virtool.data.utils import get_data_from_req
from virtool.oas.uploaded_file import UploadBody

routes = Routes()


@routes.web.view("/analyses")
class AnalysesView(APIView):
    async def get(
        self,
        page: int = Field(default=1, ge=1),
        per_page: int = Field(default=25, ge=1, le=100),
    ) -> R200[AnalysesSearchResponse]:
        """Find analyses.

        Lists analyses based on a search `term`.

        The response will only list analyses on which the user agent has read rights.

        Status Codes:
            200: Successful operation
        """
        search_result = await self.data.analyses.find(
            page,
            per_page,
            self.request["client"],
        )

        return json_response(AnalysesSearchResponse.model_validate(search_result))


@routes.web.get("/analyses/{analysis_id}")
@routes.web.delete("/analyses/{analysis_id}")
@routes.job.get("/analyses/{analysis_id}")
@routes.job.delete("/analyses/{analysis_id}")
@routes.job.patch("/analyses/{analysis_id}")
class AnalysisView(APIView):
    async def get(
        self,
        analysis_id: str,
        /,
    ) -> R200[AnalysisResponse] | R400 | R403 | R404:
        """Get an analysis.

        Fetches the details of an analysis.

        Status Codes:
            200: Successful operation
            304: Not modified
            400: Parent sample does not exist
            403: Insufficient rights
            404: Not found
        """
        if not self.client.is_job:
            try:
                if not await self.data.analyses.has_right(
                    analysis_id,
                    self.request["client"],
                    "read",
                ):
                    raise APIInsufficientRights()
            except ResourceNotFoundError:
                raise APINotFound()

        if if_modified_since_raw := self.request.headers.get("If-Modified-Since"):
            if_modified_since = arrow.get(if_modified_since_raw).naive
        else:
            if_modified_since = None

        try:
            analysis = await self.data.analyses.get(analysis_id, if_modified_since)
        except ResourceNotFoundError:
            raise APINotFound()
        except ResourceNotModifiedError:
            raise HTTPNotModified()

        return json_response(
            analysis.model_dump(by_alias=True),
            headers={
                "Cache-Control": "no-cache",
                "Last-Modified": datetime_to_isoformat(analysis.created_at),
            },
        )

    async def patch(
        self,
        analysis_id: str,
        data: AnalysisFinalizeRequest,
    ) -> R200 | R404 | R409:
        """Finalize an analysis.

        Sets the result for an analysis and marks it as ready.
        """
        try:
            document = await self.data.analyses.finalize(
                analysis_id,
                data["results"],
            )
        except ResourceNotFoundError:
            raise APINotFound(f"There is no analysis with id {analysis_id}")
        except ResourceConflictError:
            raise APIConflict("There is already a result for this analysis.")

        return json_response(document)

    async def delete(self, analysis_id: str, /) -> R204 | R403 | R404 | R409:
        """Delete an analysis.

        Permanently deletes an analysis.

        Status Codes:
            204: Successful operation
            403: Insufficient rights
            404: Not found
            409: Analysis is still running
        """
        if not self.client.is_job:
            for right in ["read", "write"]:
                try:
                    if not await self.data.analyses.has_right(
                        analysis_id,
                        self.request["client"],
                        right,
                    ):
                        raise APIInsufficientRights()
                except ResourceNotFoundError:
                    raise APINotFound()

        try:
            await self.data.analyses.delete(analysis_id, self.client.is_job)
        except ResourceConflictError:
            if self.client.is_job:
                msg = "Analysis is finalized"
            else:
                msg = "Analysis is still running"

            raise APIConflict(msg)
        except ResourceNotFoundError:
            raise APINotFound()

        raise APINoContent()


@routes.job.view("/analyses/{analysis_id}/files/{upload_id}")
@routes.web.get("/analyses/{analysis_id}/files/{upload_id}")
class AnalysisFileView(APIView):
    """Request handlers for managing analysis files.

    TODO: Remove deprecated PUT method handler.
    """

    async def get(self, upload_id: int, /) -> R200[FileResponse] | R404:
        """Download an analysis file.

        Downloads a file associated with an analysis. Some workflows retain key files
        after the complete.

        Status Codes:
            200: Successful operation
            404: Not found
        """
        try:
            name_on_disk = await self.data.analyses.get_file_name(
                upload_id,
            )
        except ResourceNotFoundError:
            raise APINotFound()

        path = get_config_from_req(self.request).data_path / "analyses" / name_on_disk

        try:
            stats = await asyncio.to_thread(file_stats, path)

            return FileResponse(
                path,
                headers={
                    "Content-Length": stats.st_size,
                    "Content-Type": "application/octet-stream",
                },
            )
        except FileNotFoundError:
            raise APINotFound()

    async def put(
        self,
        analysis_id: str,
        /,
        name: str,
        upload: UploadBody,
        analysis_format: str | None = Field(alias="format", default=None),
    ) -> R201 | R400 | R404:
        """Upload an analysis file.

        Uploads a file and associates it with an analysis. The file will be available
        for download.
        """
        return self.post(
            analysis_id,
            name=name,
            upload=upload,
            analysis_format=analysis_format,
        )

    async def post(
        self,
        analysis_id: str,
        /,
        name: str,
        upload: UploadBody,
        analysis_format: str | None = Field(alias="format", default=None),
    ) -> R201 | R400 | R404:
        """Upload an analysis file.

        Uploads a file and associates it with an analysis. The file will be available
        for download.
        """
        if analysis_format and analysis_format not in AnalysisFormat.to_list():
            raise APIBadRequest("Unsupported analysis file format")

        try:
            analysis_file = await self.data.analyses.upload_file(
                upload,
                analysis_id,
                analysis_format,
                name,
            )
        except ResourceNotFoundError:
            raise APINotFound()

        if analysis_file is None:
            return Response(status=499)

        return json_response(
            analysis_file,
            status=201,
            headers={"Location": f"/analyses/{analysis_id}/files/{analysis_file.id}"},
        )


@routes.web.view("/analyses/documents/{analysis_id}.{extension}")
class DocumentDownloadView(APIView):
    async def get(self, analysis_id: str, extension: str, /) -> R200[Response] | R404:
        """Download an analysis.

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
                self.request,
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


@routes.web.view("/analyses/{analysis_id}/{sequence_index}/blast")
class BlastView(APIView):
    async def put(
        self,
        analysis_id: str,
        sequence_index: int,
        /,
    ) -> R200[Response] | R400 | R403 | R404 | R409:
        """BLAST a NuVs contig.

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
            if not await self.data.analyses.has_right(
                analysis_id,
                self.request["client"],
                "write",
            ):
                raise APIInsufficientRights()
        except ResourceNotFoundError:
            raise APINotFound()

        try:
            document = await self.data.analyses.blast(
                analysis_id,
                sequence_index,
            )
        except ResourceConflictError as err:
            raise APIConflict(str(err))
        except ResourceNotFoundError:
            raise APINotFound("Sequence not found")

        return json_response(
            document,
            headers={"Location": f"/analyses/{analysis_id}/{sequence_index}/blast"},
            status=201,
        )
