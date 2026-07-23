from aiohttp.web import Request
from aiohttp_pydantic import PydanticView
from aiohttp_pydantic.oas.typing import r200, r400, r404
from pydantic import Field

from virtool.api.custom_json import json_response
from virtool.api.errors import (
    APIConflict,
    APIInsufficientRights,
    APINoContent,
    APINotFound,
)
from virtool.api.pagination import Page, PerPage
from virtool.api.routes import Routes
from virtool.api.streaming import stream_storage_response
from virtool.data.errors import ResourceConflictError, ResourceNotFoundError
from virtool.data.utils import get_data_from_req
from virtool.history.models import HistorySearchResult
from virtool.indexes.db import INDEX_FILE_NAMES
from virtool.indexes.models import Index, IndexSearchResult
from virtool.indexes.oas import (
    ListIndexesResponse,
    ReadyIndexesResponse,
)
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


@routes.view("/indexes")
class IndexesView(PydanticView):
    async def get(
        self,
        ready: bool | None = Field(
            default=False,
            description="Return only indexes that are ready for use in analysis.",
        ),
        page: Page = 1,
        per_page: PerPage = 25,
        archived: bool | None = Field(
            default=None,
            description=(
                "Lifecycle filter on the index's reference. Omit to return "
                "indexes for both active and archived references; `true` to "
                "return only indexes whose reference is archived; `false` to "
                "return only indexes whose reference is active."
            ),
        ),
    ) -> r200[ListIndexesResponse] | r200[list[ReadyIndexesResponse]] | r400:
        """Find indexes.

        Lists all existing indexes.

        Status Codes:
            200: Successful operation
            400: Invalid query
        """
        data = await get_data_from_req(self.request).index.find(
            ready, page, per_page, archived=archived
        )

        if isinstance(data, IndexSearchResult):
            return json_response(ListIndexesResponse.parse_obj(data))

        return json_response([ReadyIndexesResponse.parse_obj(index) for index in data])


@routes.view("/indexes/{index_id}")
class IndexView(PydanticView):
    async def get(self, index_id: str, /) -> r200[Index] | r404:
        """Get an index.

        Fetches the details for an index.

        Status Codes:
            200: Successful operation
            404: Not found

        """
        try:
            index = await get_data_from_req(self.request).index.get(
                _parse_index_id(index_id),
            )
        except ResourceNotFoundError:
            raise APINotFound()

        return json_response(index)


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


@routes.view("/indexes/{index_id}/history")
class IndexHistoryView(PydanticView):
    async def get(
        self,
        index_id: str,
        /,
        term: str | None = None,
        page: Page = 1,
        per_page: PerPage = 25,
    ) -> r200[HistorySearchResult] | r400 | r404:
        """List history.

        Lists history changes for a specific index.

        Status Codes:
            200: Successful operation
            400: Invalid query
            404: Not found

        """
        try:
            data = await get_data_from_req(self.request).index.find_changes(
                _parse_index_id(index_id), page, per_page, term
            )
        except ResourceNotFoundError:
            raise APINotFound()

        return json_response(data)


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
