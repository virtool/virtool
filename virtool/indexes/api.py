from aiohttp.web import Request

from virtool.api.custom_json import json_response
from virtool.api.errors import (
    APIConflict,
    APINoContent,
    APINotFound,
)
from virtool.api.routes import Routes
from virtool.api.streaming import stream_storage_response
from virtool.data.errors import ResourceConflictError, ResourceNotFoundError
from virtool.data.utils import get_data_from_req

routes = Routes()


def _parse_index_id(raw: str) -> int:
    """Parse the ``index_id`` path parameter as an integer.

    Indexes are addressed by their Postgres integer id, so a non-numeric path
    segment cannot match any index and is treated as a missing resource. Every
    index route parses through this helper so a non-numeric id is a uniform 404.
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
