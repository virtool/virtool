from aiohttp.web_fileresponse import FileResponse
from virtool_core.models.subtraction import SubtractionSearchResult

from virtool.api.custom_json import json_response
from virtool.api.errors import (
    APIBadRequest,
    APIConflict,
    APIForbidden,
    APINoContent,
    APINotFound,
)
from virtool.api.policy import PermissionRoutePolicy, policy
from virtool.api.routes import Routes
from virtool.api.status import R200, R201, R204, R400, R403, R404, R409
from virtool.api.view import APIView
from virtool.authorization.permissions import LegacyPermission
from virtool.data.errors import ResourceConflictError, ResourceNotFoundError
from virtool.subtractions.oas import (
    SubtractionCreateRequest,
    SubtractionCreateResponse,
    SubtractionFinalizeRequest,
    SubtractionResponse,
    SubtractionUpdateRequest,
)
from virtool.uploads.utils import body_part_file_chunker

routes = Routes()


@routes.web.view("/subtractions")
class SubtractionsView(APIView):
    async def get(
        self,
        find: str | None,
        short: bool = False,
        ready: bool = False,
    ) -> R200[SubtractionSearchResult]:
        """Find subtractions.

        Lists subtractions by their `name` or `nickname` by providing a `term` as a
        query parameter. Partial matches are supported.

        Supports pagination unless the `short` query parameter is set. In this case, an
        array of objects containing the `id` and `name` of every subtraction is
        returned.

        Status Codes:
            200: Successful operation
        """
        search_result = await self.data.subtractions.find(
            find,
            short,
            ready,
            self.request.query,
        )

        return json_response(search_result)

    @policy(PermissionRoutePolicy(LegacyPermission.MODIFY_SUBTRACTION))
    async def post(
        self,
        data: SubtractionCreateRequest,
    ) -> R201[SubtractionCreateResponse] | R400 | R403:
        """Create a subtraction.

        Creates a new subtraction.

        A job is started to build the data necessary to make the subtraction usable in
        analyses. The subtraction is usable when the `ready` property is `true`.

        Status Codes:
            201: Created
            400: Upload does not exist
            403: Not permitted

        """
        try:
            subtraction = await self.data.subtractions.create(
                data,
                self.request["client"].user_id,
                0,
            )
        except ResourceNotFoundError as err:
            if "Upload does not exist" in str(err):
                raise APIBadRequest(str(err))

            raise APINotFound()

        return json_response(
            subtraction,
            headers={"Location": f"/subtraction/{subtraction.id}"},
            status=201,
        )


@routes.web.view("/subtractions/{subtraction_id}")
@routes.job.get("/subtractions/{subtraction_id}")
class SubtractionView(APIView):
    async def get(
        self,
        subtraction_id: str,
        /,
    ) -> R200[SubtractionResponse] | R404:
        """Get a subtraction.

        Fetches the details of a subtraction.

        Status Codes:
            200: Operation Successful
            404: Not found

        """
        try:
            subtraction = await self.data.subtractions.get(
                subtraction_id,
            )
        except ResourceNotFoundError:
            raise APINotFound()

        return json_response(subtraction)

    @policy(PermissionRoutePolicy(LegacyPermission.MODIFY_SUBTRACTION))
    async def patch(
        self,
        subtraction_id: str,
        /,
        data: SubtractionUpdateRequest,
    ) -> R200[SubtractionResponse] | R400 | R403 | R404:
        """Update a subtraction.

        Updates the name or nickname of an existing subtraction.

        Status Codes:
            200: Operation successful
            400: Invalid input
            403: Not permitted
            404: Not found

        """
        try:
            subtraction = await self.data.subtractions.update(
                subtraction_id,
                data,
            )
        except ResourceNotFoundError:
            raise APINotFound()

        return json_response(subtraction)

    @policy(PermissionRoutePolicy(LegacyPermission.MODIFY_SUBTRACTION))
    async def delete(self, subtraction_id: str, /) -> R204 | R403 | R404 | R409:
        """Delete a subtraction.

        Deletes an existing subtraction.

        Status Codes:
            204: No content
            403: Not permitted
            404: Not found
            409: Has linked samples
        """
        try:
            subtraction = await self.data.subtractions.get(subtraction_id)
        except ResourceNotFoundError:
            raise APINotFound()

        if subtraction.ready and self.client.is_job:
            raise APIConflict("Only unfinalized subtractions can be deleted")

        if not subtraction.ready and not self.client:
            raise APIForbidden("Only jobs can delete unfinalized subtractions")

        try:
            await self.data.subtractions.delete(subtraction_id)
        except ResourceNotFoundError:
            raise APINotFound()

        raise APINoContent()


@routes.job.view("/subtractions/{subtraction_id}/files/{filename}")
@routes.web.get("/subtractions/{subtraction_id}/files/{filename}")
class SubtractionFileView(APIView):
    async def get(
        self,
        subtraction_id: str,
        filename: str,
        /,
    ) -> R200 | R400 | R404:
        """Download a subtraction file.

        Downloads a Bowtie2 index or FASTA file for the given subtraction.

        Files are attached to the subtraction as part of the creation job. They aren't
        available for download until the job has completed and the `ready` field is
        `true`.

        Status Codes:
            200: Operation successful
            404: Not found
        """
        try:
            descriptor = await self.data.subtractions.get_file(
                subtraction_id,
                filename,
            )
        except ResourceNotFoundError:
            raise APINotFound()

        return FileResponse(
            descriptor.path,
            headers={
                "Content-Length": descriptor.size,
                "Content-Type": "application/octet-stream",
            },
        )

    async def put(self, subtraction_id: str, filename: str) -> R201:
        """Upload subtraction file.

        Uploads a new subtraction file.
        """
        try:
            subtraction_file = await self.data.subtractions.upload_file(
                subtraction_id,
                filename,
                body_part_file_chunker(await self.request.multipart()),
            )
        except ResourceConflictError as err:
            raise APIConflict(str(err))
        except ResourceNotFoundError as err:
            if "Unsupported subtraction file name" in str(err):
                raise APINotFound(str(err))

            raise APINotFound()

        return json_response(
            subtraction_file,
            status=201,
            headers={
                "Location": f"/subtractions/{subtraction_id}/files/{subtraction_file.name}",
            },
        )


class SubtractionFinalizeView(APIView):
    async def patch(
        self,
        subtraction_id: str,
        data: SubtractionFinalizeRequest,
    ) -> R200 | R400 | R404:
        """Finalize a subtraction.

        Sets the GC and count fields for a subtraction and marks it as ready.

        Status Codes:
            200: Operation successful
            400: Invalid input
            404: Not found
        """
        try:
            subtraction = await self.data.subtractions.finalize(subtraction_id, data)
        except ResourceConflictError as err:
            raise APIConflict(str(err))
        except ResourceNotFoundError:
            raise APINotFound()

        return json_response(subtraction)
