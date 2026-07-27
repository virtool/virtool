import aiohttp.web
from aiohttp.web import Response, StreamResponse
from aiohttp_pydantic import PydanticView
from aiohttp_pydantic.oas.typing import r200, r400, r404

from virtool.api.custom_json import json_response
from virtool.api.errors import APIConflict, APINoContent, APINotFound
from virtool.api.routes import Routes
from virtool.api.schema import schema
from virtool.data.errors import ResourceConflictError, ResourceNotFoundError
from virtool.data.utils import get_data_from_req
from virtool.subtractions.models import Subtraction
from virtool.subtractions.oas import FinalizeSubtractionRequest
from virtool.uploads.utils import multipart_file_chunker

routes = Routes()


@routes.jobs_api.get("/subtractions/{subtraction_id:\\d+}")
class SubtractionView(PydanticView):
    async def get(self, subtraction_id: int, /) -> r200[Subtraction] | r404:
        """Get a subtraction.

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
            raise APINotFound()

        return json_response(subtraction)


@routes.jobs_api.put("/subtractions/{subtraction_id:\\d+}/files/{filename}")
async def upload(req) -> Response:
    """Upload subtraction file.

    Uploads a new subtraction file.
    """
    subtraction_id = int(req.match_info["subtraction_id"])
    filename = req.match_info["filename"]

    try:
        subtraction_file = await get_data_from_req(req).subtractions.upload_file(
            subtraction_id, filename, multipart_file_chunker(await req.multipart())
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
            "Location": f"/subtractions/{subtraction_id}/files/{subtraction_file.name}"
        },
    )


@routes.jobs_api.patch("/subtractions/{subtraction_id:\\d+}")
@schema(
    {
        "gc": {"type": "dict", "required": True},
        "count": {"type": "integer", "required": True},
    }
)
async def finalize_subtraction(req: aiohttp.web.Request):
    """Finalize a subtraction.

    Sets the GC field for a subtraction and marks it as ready.

    """
    data = await req.json()

    try:
        subtraction = await get_data_from_req(req).subtractions.finalize(
            int(req.match_info["subtraction_id"]), FinalizeSubtractionRequest(**data)
        )
    except ResourceConflictError as err:
        raise APIConflict(str(err))
    except ResourceNotFoundError:
        raise APINotFound()

    return json_response(subtraction)


@routes.jobs_api.delete("/subtractions/{subtraction_id:\\d+}")
async def job_delete(req: aiohttp.web.Request):
    """Remove a subtraction document.

    Only usable in the Jobs API and when subtractions are unfinalized.

    """
    subtraction_id = int(req.match_info["subtraction_id"])

    try:
        subtraction = await get_data_from_req(req).subtractions.get(subtraction_id)
    except ResourceNotFoundError:
        raise APINotFound()

    if subtraction.ready:
        raise APIConflict("Only unfinalized subtractions can be deleted")

    try:
        await get_data_from_req(req).subtractions.delete(subtraction_id)
    except ResourceNotFoundError:
        raise APINotFound()

    raise APINoContent()


@routes.view("/subtractions/{subtraction_id:\\d+}/files/{filename}")
@routes.jobs_api.get("/subtractions/{subtraction_id:\\d+}/files/{filename}")
class SubtractionFileView(PydanticView):
    async def get(self, subtraction_id: int, filename: str, /) -> r200 | r400 | r404:
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
            stream, size = await get_data_from_req(
                self.request,
            ).subtractions.get_file(subtraction_id, filename)
        except ResourceNotFoundError:
            raise APINotFound()

        try:
            first_chunk = await stream.__anext__()
        except StopAsyncIteration:
            raise APINotFound()

        response = StreamResponse(
            headers={
                "Content-Disposition": f"attachment; filename={filename}",
                "Content-Length": str(size),
                "Content-Type": "application/octet-stream",
            },
        )

        await response.prepare(self.request)
        await response.write(first_chunk)

        async for chunk in stream:
            await response.write(chunk)

        return response
