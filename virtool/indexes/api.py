from asyncio import to_thread

from aiohttp.web import FileResponse
from pydantic import Field
from virtool_core.models.index import Index, IndexSearchResult

from virtool.api.custom_json import json_response
from virtool.api.errors import (
    APIConflict,
    APIInsufficientRights,
    APINoContent,
    APINotFound,
)
from virtool.api.routes import Routes
from virtool.api.status import R200, R204, R404, R409
from virtool.api.view import APIView
from virtool.config import get_config_from_req
from virtool.data.errors import ResourceConflictError, ResourceNotFoundError
from virtool.history.oas import HistorySearchResponse
from virtool.indexes.db import INDEX_FILE_NAMES
from virtool.indexes.oas import (
    IndexResponse,
    ListIndexesResponse,
    ReadyIndexesResponse,
)
from virtool.indexes.utils import check_index_file_type, join_index_path
from virtool.references.db import check_right

routes = Routes()


@routes.web.view("/indexes")
class IndexesView(APIView):
    async def get(
        self,
        ready: bool | None = Field(
            default=False,
            description="Return only indexes that are ready for use in analysis.",
        ),
    ) -> R200[ListIndexesResponse] | R200[list[ReadyIndexesResponse]]:
        """Find indexes.

        Lists all existing indexes.

        Status Codes:
            200: Successful operation
        """
        data = await self.data.index.find(ready, self.request.query)

        if isinstance(data, IndexSearchResult):
            return json_response(ListIndexesResponse.model_validate(data))

        return json_response(
            [ReadyIndexesResponse.model_validate(index) for index in data],
        )


@routes.web.get("/indexes/{index_id}")
@routes.job.view("/indexes/{index_id}")
class IndexView(APIView):
    async def get(self, index_id: str, /) -> R200[IndexResponse] | R404:
        """Get an index.

        Fetches the details for an index.

        Status Codes:
            200: Successful operation
            404: Not found

        """
        try:
            index = await self.data.index.get(index_id)
        except ResourceNotFoundError:
            raise APINotFound()

        return json_response(index)

    async def patch(self, index_id: str) -> R200[Index] | R404 | R409:
        """Finalize an index.

        Sets the `ready` flag and updates associated OTUs' `last_indexed_version` fields.

        """
        try:
            index = await self.data.index.finalize(index_id)
        except ResourceNotFoundError:
            raise APINotFound
        except ResourceConflictError as err:
            raise APIConflict(str(err))

        return json_response(index)

    async def delete_index(self, index_id: str, /) -> R204 | R404:
        """Delete an index.

        Deletes the index with the given id and reset history relating to that index.
        """
        try:
            await self.data.index.delete(index_id)
        except ResourceNotFoundError:
            raise APINotFound(f"There is no index with id: {index_id}.")

        raise APINoContent()


@routes.job.view("/indexes/{index_id}/files/{filename}")
@routes.web.get("/indexes/{index_id}/files/{filename}")
class IndexFileView(APIView):
    async def get(self, index_id: str, filename: str, /) -> R200 | R404:
        """Download index files.

        Downloads files relating to a given index.

        Status Codes:
            200: Successful operation
            404: Not found
        """
        if filename not in INDEX_FILE_NAMES:
            raise APINotFound

        try:
            reference = await self.data.index.get_reference(index_id)
        except ResourceNotFoundError:
            raise APINotFound()

        if not await check_right(self.request, reference.id, "read"):
            raise APIInsufficientRights

        if filename == "otus.json.gz":
            try:
                path = await self.data.index.get_json_path(index_id)
            except ResourceNotFoundError:
                raise APINotFound()
        else:
            path = (
                join_index_path(
                    get_config_from_req(self.request).data_path,
                    reference.id,
                    index_id,
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

    async def put(self, index_id: str, filename: str, /) -> R200 | R404 | R409:
        """Upload an index file.

        Uploads a new index file.
        """
        if filename not in INDEX_FILE_NAMES:
            raise APINotFound("Index file not found")

        try:
            reference = await self.data.index.get_reference(index_id)
        except ResourceNotFoundError:
            raise APINotFound

        file_type = check_index_file_type(filename)

        try:
            index_file = await self.data.index.upload_file(
                reference.id,
                index_id,
                file_type,
                filename,
                self.request.multipart,
            )
        except ResourceConflictError:
            raise APIConflict("File name already exists")

        return json_response(
            index_file,
            headers={"Location": f"/indexes/{index_id}/files/{filename}"},
            status=201,
        )


@routes.web.view("/indexes/{index_id}/history")
class IndexHistoryView(APIView):
    async def get(self, index_id: str, /) -> R200[HistorySearchResponse] | R404:
        """List history.

        Lists history changes for a specific index.

        Status Codes:
            200: Successful operation
            404: Not found

        """
        try:
            data = await self.data.index.find_changes(
                index_id,
                self.request.query,
            )
        except ResourceNotFoundError:
            raise APINotFound()

        return json_response(data)
