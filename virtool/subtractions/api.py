import logging
from typing import Union, Optional

import aiohttp.web
from aiohttp.web_exceptions import HTTPBadRequest, HTTPConflict, HTTPNoContent
from aiohttp.web_fileresponse import FileResponse
from aiohttp_pydantic import PydanticView
from aiohttp_pydantic.oas.typing import r200, r201, r204, r404, r400, r403, r409
from virtool_core.models.subtraction import SubtractionSearchResult

from virtool.api.response import NotFound, json_response
from virtool.authorization.permissions import LegacyPermission
from virtool.data.errors import ResourceNotFoundError, ResourceConflictError
from virtool.data.utils import get_data_from_req
from virtool.http.policy import policy, PermissionRoutePolicy
from virtool.http.routes import Routes
from virtool.http.schema import schema
from virtool.subtractions.oas import (
    CreateSubtractionRequest,
    UpdateSubtractionRequest,
    CreateSubtractionResponse,
    SubtractionResponse,
    FinalizeSubtractionRequest,
)

logger = logging.getLogger("subtractions")

routes = Routes()


@routes.view("/spaces/{space_id}/subtractions")
@routes.view("/subtractions")
class SubtractionsView(PydanticView):
    async def get(
        self, find: Optional[str], short: bool = False, ready: bool = False
    ) -> r200[SubtractionSearchResult]:
        """
        Find subtractions.

        Fetches subtractions by their `name` or `nickname` by providing a `term` as a
        query parameter. Partial matches are supported.

        Supports pagination unless the `short` query parameter is set. In this case, an
        array of objects containing the `id` and `name` of every subtraction is
        returned.

        Status Codes:
            200: Successful operation
        """
        search_result = await get_data_from_req(self.request).subtractions.find(
            find, short, ready, self.request.query
        )

        return json_response(search_result)

    @policy(PermissionRoutePolicy(LegacyPermission.MODIFY_SUBTRACTION))
    async def post(
        self, data: CreateSubtractionRequest
    ) -> Union[r201[CreateSubtractionResponse], r400, r403]:
        """
        Create a subtraction.

        Creates a new subtraction.

        A job is started to build the data necessary to make the subtraction usable in
        analyses. The subtraction is usable when the `ready` property is `true`.

        Status Codes:
            201: Created
            400: Upload does not exist
            403: Not permitted

        """
        try:
            subtraction = await get_data_from_req(self.request).subtractions.create(
                data, self.request["client"].user_id, 0
            )
        except ResourceNotFoundError as err:
            if "Upload does not exist" in str(err):
                raise HTTPBadRequest(text=str(err))

            raise NotFound

        return json_response(
            subtraction,
            headers={"Location": f"/subtraction/{subtraction.id}"},
            status=201,
        )


@routes.view("/spaces/{space_id}/subtractions/{subtraction_id}")
@routes.view("/subtractions/{subtraction_id}")
@routes.jobs_api.get("/subtractions/{subtraction_id}")
class SubtractionView(PydanticView):
    async def get(
        self, subtraction_id: str, /
    ) -> Union[r200[SubtractionResponse], r404]:
        """
        Get a subtraction.

        Fetches the details of a subtraction.

        Status Codes:
            200: Operation Successful
            404: Not found

        """
        try:
            subtraction = await get_data_from_req(self.request).subtractions.get(
                subtraction_id
            )
        except ResourceNotFoundError:
            raise NotFound

        return json_response(subtraction)

    @policy(PermissionRoutePolicy(LegacyPermission.MODIFY_SUBTRACTION))
    async def patch(
        self, subtraction_id: str, /, data: UpdateSubtractionRequest
    ) -> Union[r200[SubtractionResponse], r400, r403, r404]:
        """
        Update a subtraction.

        Updates the name or nickname of an existing subtraction.

        Status Codes:
            200: Operation successful
            400: Invalid input
            403: Not permitted
            404: Not found

        """
        try:
            subtraction = await get_data_from_req(self.request).subtractions.update(
                subtraction_id, data
            )
        except ResourceNotFoundError:
            raise NotFound

        return json_response(subtraction)

    @policy(PermissionRoutePolicy(LegacyPermission.MODIFY_SUBTRACTION))
    async def delete(self, subtraction_id: str, /) -> Union[r204, r403, r404, r409]:
        """
        Delete a subtraction.

        Deletes an existing subtraction.

        Status Codes:
            204: No content
            403: Not permitted
            404: Not found
            409: Has linked samples
        """
        try:
            await get_data_from_req(self.request).subtractions.delete(subtraction_id)
        except ResourceNotFoundError:
            raise NotFound

        raise HTTPNoContent


@routes.jobs_api.put("/subtractions/{subtraction_id}/files/{filename}")
async def upload(req):
    """
    Upload subtraction file.

    Uploads a new subtraction file.
    """
    subtraction_id = req.match_info["subtraction_id"]
    filename = req.match_info["filename"]

    try:
        subtraction_file = await get_data_from_req(req).subtractions.upload_file(
            subtraction_id, filename, await req.multipart()
        )
    except ResourceConflictError as err:
        raise HTTPConflict(text=str(err))
    except ResourceNotFoundError as err:
        raise NotFound(str(err))

    return json_response(
        subtraction_file,
        status=201,
        headers={
            "Location": f"/subtractions/{subtraction_id}/files/{subtraction_file.name}"
        },
    )


@routes.jobs_api.patch("/subtractions/{subtraction_id}")
@schema(
    {
        "gc": {"type": "dict", "required": True},
        "count": {"type": "integer", "required": True},
    }
)
async def finalize_subtraction(req: aiohttp.web.Request):
    """
    Finalize subtraction.

    Sets the GC field for a subtraction and marks it as ready.

    """
    data = await req.json()

    try:
        subtraction = await get_data_from_req(req).subtractions.finalize(
            req.match_info["subtraction_id"], FinalizeSubtractionRequest(**data)
        )
    except ResourceConflictError as err:
        raise HTTPConflict(text=str(err))
    except ResourceNotFoundError:
        raise NotFound

    return json_response(subtraction)


@routes.jobs_api.delete("/subtractions/{subtraction_id}")
async def job_delete(req: aiohttp.web.Request):
    """
    Remove a subtraction document.

    Only usable in the Jobs API and when subtractions are unfinalized.

    """
    subtraction_id = req.match_info["subtraction_id"]

    try:
        subtraction = await get_data_from_req(req).subtractions.get(subtraction_id)
    except ResourceNotFoundError:
        raise NotFound

    if subtraction.ready:
        raise HTTPConflict(text="Only unfinalized subtractions can be deleted")

    try:
        await get_data_from_req(req).subtractions.delete(subtraction_id)
    except ResourceNotFoundError:
        raise NotFound

    raise HTTPNoContent


@routes.view("/subtractions/{subtraction_id}/files/{filename}")
@routes.jobs_api.get("/subtractions/{subtraction_id}/files/{filename}")
class SubtractionFileView(PydanticView):
    async def get(
        self, subtraction_id: str, filename: str, /
    ) -> Union[r200, r400, r404]:
        """
        Download a subtraction file.

        Fetches a Bowtie2 index or FASTA file for the given subtraction.

        Files are attached to the subtraction as part of the creation job. They aren't
        available for download until the job has completed and the `ready` field is
        `true`.

        Status Codes:
            200: Operation successful
            404: Not found
        """
        try:
            descriptor = await get_data_from_req(self.request).subtractions.get_file(
                subtraction_id, filename
            )
        except ResourceNotFoundError:
            raise NotFound

        return FileResponse(
            descriptor.path,
            headers={
                "Content-Length": descriptor.size,
                "Content-Type": "application/octet-stream",
            },
        )
