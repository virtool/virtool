from asyncio import to_thread
from typing import Union

from aiohttp.web import FileResponse, Request
from aiohttp_pydantic import PydanticView
from aiohttp_pydantic.oas.typing import r200, r404
from pydantic import Field
from virtool_core.models.index import IndexSearchResult

from virtool.api.errors import (
    APINotFound,
    APIInsufficientRights,
    APIConflict,
    APINoContent,
)
from virtool.api.custom_json import json_response
from virtool.config import get_config_from_req
from virtool.data.errors import ResourceNotFoundError, ResourceConflictError
from virtool.data.utils import get_data_from_req
from virtool.history.oas import ListHistoryResponse
from virtool.api.routes import Routes
from virtool.indexes.db import INDEX_FILE_NAMES
from virtool.indexes.oas import (
    ListIndexesResponse,
    GetIndexResponse,
    ReadyIndexesResponse,
)
from virtool.indexes.utils import check_index_file_type, join_index_path
from virtool.references.db import check_right

routes = Routes()


@routes.view("/indexes")
class IndexesView(PydanticView):
    async def get(
        self,
        ready: bool | None = Field(
            default=False,
            description="Return only indexes that are ready for use in analysis.",
        ),
    ) -> r200[ListIndexesResponse] | r200[list[ReadyIndexesResponse]]:
        """
        Find indexes.

        Lists all existing indexes.

        Status Codes:
            200: Successful operation
        """
        data = await get_data_from_req(self.request).index.find(
            ready, self.request.query
        )

        if isinstance(data, IndexSearchResult):
            return json_response(ListIndexesResponse.parse_obj(data))

        return json_response([ReadyIndexesResponse.parse_obj(index) for index in data])


@routes.view("/indexes/{index_id}")
@routes.jobs_api.get("/indexes/{index_id}")
class IndexView(PydanticView):
    async def get(self, index_id: str, /) -> Union[r200[GetIndexResponse], r404]:
        """
        Get an index.

        Fetches the details for an index.

        Status Codes:
            200: Successful operation
            404: Not found

        """
        try:
            index = await get_data_from_req(self.request).index.get(index_id)
        except ResourceNotFoundError:
            raise APINotFound()

        return json_response(index)


@routes.jobs_api.get("/indexes/{index_id}/files/otus.json.gz")
async def download_otus_json(req):
    """
    Download OTUs json.

    Downloads a complete compressed JSON representation of the index OTUs.

    """
    try:
        json_path = await get_data_from_req(req).index.get_json_path(
            req.match_info["index_id"]
        )
    except ResourceNotFoundError:
        raise APINotFound()

    return FileResponse(
        json_path,
        headers={
            "Content-Disposition": "attachment; filename=otus.json.gz",
            "Content-Type": "application/octet-stream",
        },
    )


@routes.view("/indexes/{index_id}/files/{filename}")
class IndexFileView(PydanticView):
    async def get(self, index_id: str, filename: str, /) -> Union[r200, r404]:
        """
        Download index files.

        Downloads files relating to a given index.

        Status Codes:
            200: Successful operation
            404: Not found
        """
        if filename not in INDEX_FILE_NAMES:
            raise APINotFound()

        try:
            reference = await get_data_from_req(self.request).index.get_reference(
                index_id
            )
        except ResourceNotFoundError:
            raise APINotFound()

        if not await check_right(self.request, reference.id, "read"):
            raise APIInsufficientRights()

        path = (
            join_index_path(
                get_config_from_req(self.request).data_path, reference.id, index_id
            )
            / filename
        )

        if await to_thread(path.exists):
            return FileResponse(
                path,
                headers={
                    "Content-Disposition": f"attachment; filename={filename}",
                    "Content-Type": "application/octet-stream",
                },
            )

        raise APINotFound("File not found")


@routes.jobs_api.get("/indexes/{index_id}/files/{filename}")
async def download_index_file_for_jobs(req: Request):
    """
    Download index files for jobs.

    Downloads files relating to a given index for jobs.

    """
    index_id = req.match_info["index_id"]
    filename = req.match_info["filename"]

    if filename not in INDEX_FILE_NAMES:
        raise APINotFound()

    try:
        reference = await get_data_from_req(req).index.get_reference(index_id)
    except ResourceNotFoundError:
        raise APINotFound()

    path = (
        join_index_path(get_config_from_req(req).data_path, reference.id, index_id)
        / filename
    )

    if await to_thread(path.exists):
        return FileResponse(path)

    raise APINotFound("File not found")


@routes.jobs_api.put("/indexes/{index_id}/files/{filename}")
async def upload(req):
    """
    Upload an index file.

    Uploads a new index file.
    """
    index_id = req.match_info["index_id"]
    name = req.match_info["filename"]

    if name not in INDEX_FILE_NAMES:
        raise APINotFound("Index file not found")

    try:
        reference = await get_data_from_req(req).index.get_reference(index_id)
    except ResourceNotFoundError:
        raise APINotFound()

    file_type = check_index_file_type(name)

    try:
        index_file = await get_data_from_req(req).index.upload_file(
            reference.id, index_id, file_type, name, req.multipart
        )
    except ResourceConflictError:
        raise APIConflict("File name already exists")

    return json_response(
        index_file,
        headers={"Location": f"/indexes/{index_id}/files/{name}"},
        status=201,
    )


@routes.jobs_api.patch("/indexes/{index_id}")
async def finalize(req):
    """
    Finalize an index.

    Sets the `ready` flag and updates associated OTUs' `last_indexed_version` fields.

    """
    index_id = req.match_info["index_id"]

    try:
        document = await get_data_from_req(req).index.finalize(index_id)
    except ResourceNotFoundError:
        raise APINotFound
    except ResourceConflictError as err:
        raise APIConflict(str(err))

    return json_response(document)


@routes.view("/indexes/{index_id}/history")
class IndexHistoryView(PydanticView):
    async def get(self, index_id: str, /) -> Union[r200[ListHistoryResponse], r404]:
        """
        List history.

        Lists history changes for a specific index.

        Status Codes:
            200: Successful operation
            404: Not found

        """
        try:
            data = await get_data_from_req(self.request).index.find_changes(
                index_id, self.request.query
            )
        except ResourceNotFoundError:
            raise APINotFound()

        return json_response(data)


@routes.jobs_api.delete("/indexes/{index_id}")
async def delete_index(req: Request):
    """
    Delete an index.

    Deletes the index with the given id and reset history relating to that index.
    """
    index_id = req.match_info["index_id"]

    try:
        await get_data_from_req(req).index.delete(index_id)
    except ResourceNotFoundError:
        raise APINotFound(f"There is no index with id: {index_id}.")

    raise APINoContent()
