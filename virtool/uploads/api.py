from asyncio import CancelledError
from logging import getLogger
from typing import List, Union, Optional

from aiohttp.web_exceptions import HTTPBadRequest
from aiohttp.web_fileresponse import FileResponse
from aiohttp.web_response import Response
from aiohttp_pydantic import PydanticView
from aiohttp_pydantic.oas.typing import r200, r201, r204, r401, r403, r404
from pydantic import Field, conint

from virtool.api.response import InvalidQuery, json_response, NotFound
from virtool.authorization.permissions import LegacyPermission
from virtool.config import get_config_from_req
from virtool.data.errors import ResourceNotFoundError
from virtool.data.utils import get_data_from_req
from virtool.http.policy import policy, PermissionRoutePolicy
from virtool.http.routes import Routes
from virtool.uploads.models import UploadType
from virtool.uploads.oas import GetUploadsResponse, CreateUploadResponse
from virtool.uploads.utils import naive_validator, naive_writer, get_upload_path

logger = getLogger(__name__)

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

        Returns JSON details of all files uploaded to the instance.

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
        name: str,
        upload_type: str = Field(alias="type"),
        reserved: Optional[bool] = False,
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

        errors = naive_validator(self.request)

        if errors:
            raise InvalidQuery(errors)

        if upload_type and upload_type not in UploadType.to_list():
            raise HTTPBadRequest(text="Unsupported upload type")

        upload = await get_data_from_req(self.request).uploads.create(
            name, upload_type, reserved, user=self.request["client"].user_id
        )

        file_path = self.request.app["config"].data_path / "files" / upload.name_on_disk

        try:
            size = await naive_writer(await self.request.multipart(), file_path)

            upload = await get_data_from_req(self.request).uploads.finalize(
                size, upload.id
            )
        except CancelledError:
            logger.debug("Upload aborted: %s", upload.id)

            await get_data_from_req(self.request).uploads.delete(upload.id)

            return Response(status=499)

        logger.debug("Upload succeeded: %s", upload.id)

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

        Returns a previously uploaded file.

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
                self.request.app["config"], upload.name_on_disk
            )
        except ResourceNotFoundError:
            raise NotFound

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

        Deletes an upload.

        Status Codes:
            204: Successful operation
            401: Requires authorization
            403: Not permitted
            404: Not found
        """

        try:
            await get_data_from_req(self.request).uploads.delete(upload_id)
        except ResourceNotFoundError:
            raise NotFound

        return Response(status=204)


@routes.jobs_api.get("/uploads/{id}")
async def download(req):
    """
    Downloads an upload.

    """
    upload_id = int(req.match_info["id"])

    try:
        upload = await get_data_from_req(req).uploads.get(upload_id)
    except ResourceNotFoundError:
        raise NotFound

    upload_path = await get_upload_path(get_config_from_req(req), upload.name_on_disk)

    return FileResponse(
        upload_path,
        headers={
            "Content-Disposition": f"attachment; filename={upload.name}",
            "Content-Type": "application/octet-stream",
        },
    )
