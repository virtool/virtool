from aiohttp.web import Request
from aiohttp_pydantic import PydanticView
from aiohttp_pydantic.oas.typing import r200, r404

from virtool.api.custom_json import json_response
from virtool.api.errors import (
    APIConflict,
    APIInsufficientRights,
    APINoContent,
    APINotFound,
)
from virtool.api.routes import Routes
from virtool.api.streaming import stream_storage_response
from virtool.data.errors import ResourceConflictError, ResourceNotFoundError
from virtool.data.utils import get_data_from_req
from virtool.indexes.db import INDEX_FILE_NAMES
from virtool.models.roles import AdministratorRole

routes = Routes()


def _parse_index_id(raw: str) -> int:
    """Parse the ``index_id`` path parameter as an integer.

    Indexes are addressed publicly by their Postgres integer id, so a non-numeric
    path segment cannot match any index and is treated as a missing resource. Every
    index route parses through this helper so a non-numeric id is a uniform 404 across
    the public and jobs APIs.
    """
    try:
        return int(raw)
    except ValueError:
        raise APINotFound()


@routes.jobs_api.get("/indexes/{index_id}")
async def get_index_for_jobs(req: Request):
    """Get an index for jobs.

    Fetches the details for an index.
    """
    try:
        index = await get_data_from_req(req).index.get(
            _parse_index_id(req.match_info["index_id"])
        )
    except ResourceNotFoundError:
        raise APINotFound()

    return json_response(index)


@routes.jobs_api.get("/indexes/{index_id}/files/otus.json.gz")
async def download_otus_json(req):
    """Download OTUs json.

    Downloads a complete compressed JSON representation of the index OTUs.

    """
    try:
        stream, size = await get_data_from_req(req).index.get_otus_json(
            _parse_index_id(req.match_info["index_id"]),
        )
    except ResourceNotFoundError:
        raise APINotFound()

    return await stream_storage_response(
        req,
        stream,
        {
            "Content-Disposition": "attachment; filename=otus.json.gz",
            "Content-Length": str(size),
            "Content-Type": "application/octet-stream",
        },
    )


@routes.view("/indexes/{index_id}/files/{filename}")
class IndexFileView(PydanticView):
    async def get(self, index_id: str, filename: str, /) -> r200 | r404:
        """Download index files.

        Downloads files relating to a given index.

        Status Codes:
            200: Successful operation
            404: Not found
        """
        if filename not in INDEX_FILE_NAMES:
            raise APINotFound()

        index_id = _parse_index_id(index_id)

        try:
            reference = await get_data_from_req(self.request).index.get_reference(
                index_id
            )
        except ResourceNotFoundError:
            raise APINotFound()

        client = self.request["client"]

        if not await get_data_from_req(self.request).references.check_right(
            reference.id,
            "read",
            user_id=client.user_id,
            group_ids=client.groups,
            administrator=client.administrator_role == AdministratorRole.FULL,
        ):
            raise APIInsufficientRights()

        try:
            stream, size = await get_data_from_req(
                self.request,
            ).index.get_index_file(index_id, filename)
        except ResourceNotFoundError:
            raise APINotFound("File not found")

        return await stream_storage_response(
            self.request,
            stream,
            {
                "Content-Disposition": f"attachment; filename={filename}",
                "Content-Length": str(size),
                "Content-Type": "application/octet-stream",
            },
        )


@routes.jobs_api.get("/indexes/{index_id}/files/{filename}")
async def download_index_file_for_jobs(req: Request):
    """Download index files for jobs.

    Downloads files relating to a given index for jobs.

    """
    index_id = _parse_index_id(req.match_info["index_id"])
    filename = req.match_info["filename"]

    try:
        stream, size = await get_data_from_req(req).index.get_index_file(
            index_id,
            filename,
        )
    except ResourceNotFoundError:
        raise APINotFound()

    return await stream_storage_response(
        req,
        stream,
        {
            "Content-Length": str(size),
            "Content-Type": "application/octet-stream",
        },
    )


@routes.jobs_api.delete("/indexes/{index_id}")
async def delete_index(req: Request):
    """Delete an index.

    Deletes the index with the given id and reset history relating to that index.
    """
    index_id = _parse_index_id(req.match_info["index_id"])

    try:
        await get_data_from_req(req).index.delete(index_id)
    except ResourceNotFoundError:
        raise APINotFound(f"There is no index with id: {index_id}.")
    except ResourceConflictError as err:
        raise APIConflict(str(err))

    raise APINoContent()
