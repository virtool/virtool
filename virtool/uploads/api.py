from typing import List, Union, Optional

from aiohttp.web_fileresponse import FileResponse
from aiohttp.web_response import Response
from aiohttp_pydantic import PydanticView
from aiohttp_pydantic.oas.typing import r200, r201, r204, r401, r403, r404
from pydantic import Field, conint

from virtool.api.errors import APINotFound
from virtool.api.custom_json import json_response
from virtool.authorization.permissions import LegacyPermission
from virtool.config import get_config_from_req
from virtool.data.errors import ResourceNotFoundError
from virtool.data.utils import get_data_from_req
from virtool.api.policy import policy, PermissionRoutePolicy
from virtool.api.routes import Routes
from virtool.uploads.models import UploadType
from virtool.uploads.oas import GetUploadsResponse, CreateUploadResponse
from virtool.uploads.utils import get_upload_path
from virtool.uploads.utils import multipart_file_chunker

routes = Routes()


@routes.view("/spaces/{space_id}/uploads")
@routes.view("/uploads")
class UploadsView(PydanticView):
    async def get(
        self,
        user: Optional[str] = None,
        page: conint(ge=1) = 1,
        per_page: conint(ge=1, le=100) = 25,
        upload_type: Optional[str] = None,
        paginate: Optional[bool] = False,
    ) -> r200[List[GetUploadsResponse]]:
        """
        List uploads.

        Lists JSON details of all files uploaded to the instance.

        Status Codes:
            200: Successful operation
        """

        uploads = await get_data_from_req(self.request).uploads.find(
            user, page, per_page, upload_type, paginate
        )

        if paginate:
            return json_response(uploads)

        return json_response({"documents": uploads})

    @policy(PermissionRoutePolicy(LegacyPermission.UPLOAD_FILE))
    async def post(
        self,
        /,
        name: str,
        upload_type: UploadType = Field(alias="type"),
    ) -> Union[r201[CreateUploadResponse], r401, r403, r404]:
        """
        Upload a file.

        Accepts file uploads as multipart requests. The request should contain a single
        field ``file`` containing the file data.

        A file ``name`` and ``type`` must be included in the query string.

        Status Codes:
            201: Successful operation
            401: Requires authorization
            403: Not permitted
            404: Not found
        """
        upload = await get_data_from_req(self.request).uploads.create(
            multipart_file_chunker(await self.request.multipart()),
            name,
            upload_type,
            user=self.request["client"].user_id,
        )

        return json_response(
            upload,
            status=201,
            headers={"Location": f"/uploads/{upload.id}"},
        )


@routes.view("/spaces/{space_id}/uploads/{upload_id}")
@routes.view("/uploads/{upload_id}")
class UploadView(PydanticView):
    async def get(self, upload_id: int, /) -> Union[r200[FileResponse], r404]:
        """
        Download an upload.

        Downloads a previously uploaded file.

        Headers:
            Content-Disposition: attachment; filename=<name>
            Content-Type: application/octet-stream

        Status Codes:
            200: Successful operation
            404: Not found
        """

        try:
            upload = await get_data_from_req(self.request).uploads.get(upload_id)

            upload_path = await get_upload_path(
                get_config_from_req(self.request), upload.name_on_disk
            )
        except ResourceNotFoundError:
            raise APINotFound()

        return FileResponse(
            upload_path,
            headers={
                "Content-Disposition": f"attachment; filename={upload.name}",
                "Content-Type": "application/octet-stream",
            },
        )

    @policy(PermissionRoutePolicy(LegacyPermission.REMOVE_FILE))
    async def delete(self, upload_id: int, /) -> Union[r204, r401, r403, r404]:
        """
        Delete an upload.

        Deletes an upload using its 'upload id'.

        Status Codes:
            204: Successful operation
            401: Requires authorization
            403: Not permitted
            404: Not found
        """

        try:
            await get_data_from_req(self.request).uploads.delete(upload_id)
        except ResourceNotFoundError:
            raise APINotFound()

        return Response(status=204)


@routes.jobs_api.get("/uploads/{id}")
async def download(req):
    """
    Download an upload.

    Downloads an upload using its 'upload id'.
    """
    upload_id = int(req.match_info["id"])

    try:
        upload = await get_data_from_req(req).uploads.get(upload_id)
    except ResourceNotFoundError:
        raise APINotFound()

    upload_path = await get_upload_path(get_config_from_req(req), upload.name_on_disk)

    return FileResponse(
        upload_path,
        headers={
            "Content-Disposition": f"attachment; filename={upload.name}",
            "Content-Type": "application/octet-stream",
        },
    )
