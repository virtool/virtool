from asyncio import CancelledError
from logging import getLogger
from typing import List, Union

from aiohttp.web_exceptions import HTTPBadRequest
from aiohttp.web_fileresponse import FileResponse
from aiohttp.web_response import Response
from aiohttp_pydantic import PydanticView
from aiohttp_pydantic.oas.typing import r200, r201, r204, r401, r403, r404

import virtool.uploads.db
from virtool.api.response import InvalidQuery, NotFound, json_response
from virtool.api.utils import get_req_bool
from virtool.http.policy import PermissionsRoutePolicy, policy
from virtool.http.routes import Routes
from virtool.mongo.transforms import apply_transforms
from virtool.uploads.models import Upload, UploadType
from virtool.uploads.oas import GetUploadsResponse, CreateUploadResponse
from virtool.uploads.utils import naive_validator, naive_writer
from virtool.users.db import AttachUserTransform
from virtool.users.utils import Permission


logger = getLogger(__name__)

routes = Routes()


@routes.view("/uploads")
class UploadsView(PydanticView):
    async def get(self) -> r200[List[GetUploadsResponse]]:
        """
        List uploads.

        Returns JSON details of all files uploaded to the instance.

        Status Codes:
            200: Successful operation
        """
        pg = self.request.app["pg"]
        user = self.request.query.get("user")
        upload_type = self.request.query.get("type")

        ready = get_req_bool(self.request, "ready")

        uploads = await virtool.uploads.db.find(pg, user, upload_type, ready)

        return json_response(
            {
                "documents": await apply_transforms(
                    uploads, [AttachUserTransform(self.request.app["db"])]
                )
            }
        )

    @policy(PermissionsRoutePolicy(Permission.upload_file))
    async def post(self) -> Union[r201[CreateUploadResponse], r401, r403, r404]:
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
        pg = self.request.app["pg"]
        upload_type = self.request.query.get("type")

        errors = naive_validator(self.request)

        if errors:
            raise InvalidQuery(errors)

        name = self.request.query["name"]

        if upload_type and upload_type not in UploadType.to_list():
            raise HTTPBadRequest(text="Unsupported upload type")

        upload = await virtool.uploads.db.create(
            pg, name, upload_type, user=self.request["client"].user_id
        )

        upload_id = upload["id"]

        file_path = (
            self.request.app["config"].data_path / "files" / upload["name_on_disk"]
        )

        try:
            size = await naive_writer(await self.request.multipart(), file_path)

            upload = await virtool.uploads.db.finalize(pg, size, upload_id, Upload)
        except CancelledError:
            logger.debug(f"Upload aborted: {upload_id}")

            await virtool.uploads.db.delete(self.request, pg, upload_id)

            return Response(status=499)

        logger.debug(f"Upload succeeded: {upload_id}")

        return json_response(
            await apply_transforms(
                upload, [AttachUserTransform(self.request.app["db"])]
            ),
            status=201,
            headers={"Location": f"/uploads/{upload_id}"},
        )


@routes.view("/uploads/{id}")
class UploadView(PydanticView):
    async def get(self) -> Union[r200[FileResponse], r404]:
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
        pg = self.request.app["pg"]

        upload_id = int(self.request.match_info["id"])

        upload = await virtool.uploads.db.get(pg, upload_id)

        if not upload:
            raise NotFound()

        upload_path = (
            self.request.app["config"].data_path / "files" / upload.name_on_disk
        )

        # check if the file has been manually removed by the user
        if not upload_path.exists():
            raise NotFound("Uploaded file not found at expected location")

        return FileResponse(
            upload_path,
            headers={
                "Content-Disposition": f"attachment; filename={upload.name}",
                "Content-Type": "application/octet-stream",
            },
        )

    @policy(PermissionsRoutePolicy(Permission.remove_file))
    async def delete(self) -> Union[r204, r401, r403, r404]:
        """
        Delete an upload.

        Deletes an upload.

        Status Codes:
            204: Successful operation
            401: Requires authorization
            403: Not permitted
            404: Not found
        """
        pg = self.request.app["pg"]
        upload_id = int(self.request.match_info["id"])

        upload = await virtool.uploads.db.delete(self.request, pg, upload_id)

        if not upload:
            raise NotFound()

        return Response(status=204)


@routes.jobs_api.get("/uploads/{id}")
async def download(req):
    """
    Downloads an upload.

    """
    pg = req.app["pg"]

    upload_id = int(req.match_info["id"])

    upload = await virtool.uploads.db.get(pg, upload_id)

    if not upload:
        raise NotFound()

    upload_path = req.app["config"].data_path / "files" / upload.name_on_disk

    # check if the file has been manually removed by the user
    if not upload_path.exists():
        raise NotFound("Uploaded file not found at expected location")

    return FileResponse(
        upload_path,
        headers={
            "Content-Disposition": f"attachment; filename={upload.name}",
            "Content-Type": "application/octet-stream",
        },
    )
