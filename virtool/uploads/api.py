from aiohttp.web_fileresponse import FileResponse
from aiohttp.web_response import Response
from pydantic import Field

from virtool.api.custom_json import json_response
from virtool.api.errors import APINotFound
from virtool.api.policy import PermissionRoutePolicy, policy
from virtool.api.routes import Routes
from virtool.api.status import R200, R201, R204, R401, R403, R404
from virtool.api.view import APIView
from virtool.authorization.permissions import LegacyPermission
from virtool.config import get_config_from_req
from virtool.data.errors import ResourceNotFoundError
from virtool.oas.uploaded_file import UploadBody
from virtool.uploads.models import UploadType
from virtool.uploads.oas import UploadMinimalResponse, UploadResponse
from virtool.uploads.utils import get_upload_path

routes = Routes()


@routes.web.view("/uploads")
class UploadsView(APIView):
    """An API view for operations on the uploads collection."""

    async def get(
        self,
        user: str | None = None,
        page: int = Field(default=1, ge=1),
        per_page: int = Field(default=25, ge=1, le=100),
        upload_type: str | None = None,
    ) -> R200[list[UploadMinimalResponse]]:
        """List uploads.

        Lists JSON details of all files uploaded to the instance.

        Status Codes:
            200: Successful operation
        """
        uploads = await self.data.uploads.find(
            user,
            page,
            per_page,
            upload_type,
        )

        return json_response(uploads)

    @policy(PermissionRoutePolicy(LegacyPermission.UPLOAD_FILE))
    async def post(
        self,
        /,
        name: str,
        upload: UploadBody,
        upload_type: UploadType = Field(alias="type"),
    ) -> R201[UploadResponse] | R401 | R403 | R404:
        """Upload a file.

        Accepts file uploads as multipart requests. The request should contain a single
        field ``file`` containing the file data.

        A file ``name`` and ``type`` must be included in the query string.

        Status Codes:
            201: Successful operation
            401: Requires authorization
            403: Not permitted
            404: Not found
        """
        upload = await self.data.uploads.create(
            upload,
            name,
            upload_type,
            user=self.request["client"].user_id,
        )

        return json_response(
            upload,
            status=201,
            headers={"Location": f"/uploads/{upload.id}"},
        )


@routes.job.get("/uploads/{upload_id}")
@routes.web.view("/uploads/{upload_id}")
class UploadView(APIView):
    async def get(self, upload_id: int, /) -> R200[FileResponse] | R404:
        """Download an upload.

        Downloads a previously uploaded file.

        Headers:
            Content-Disposition: attachment; filename=<name>
            Content-Type: application/octet-stream

        Status Codes:
            200: Successful operation
            404: Not found
        """
        try:
            upload = await self.data.uploads.get(upload_id)

            path = await get_upload_path(
                get_config_from_req(self.request),
                upload.name_on_disk,
            )
        except ResourceNotFoundError:
            raise APINotFound from None

        return FileResponse(
            path,
            chunk_size=1024 * 1024,
            headers={
                "Content-Disposition": f"attachment; filename={upload.name}",
                "Content-Type": "application/octet-stream",
            },
        )

    @policy(PermissionRoutePolicy(LegacyPermission.REMOVE_FILE))
    async def delete(self, upload_id: int, /) -> R204 | R401 | R403 | R404:
        """Delete an upload.

        Deletes an upload using its 'upload id'.

        Status Codes:
            204: Successful operation
            401: Requires authorization
            403: Not permitted
            404: Not found
        """
        try:
            await self.data.uploads.delete(upload_id)
        except ResourceNotFoundError:
            raise APINotFound from None

        return Response(status=204)
