import logging
from typing import Union, List

from aiohttp.web import FileResponse, Request, Response
from aiohttp.web_exceptions import HTTPConflict, HTTPNoContent
from aiohttp_pydantic import PydanticView
from aiohttp_pydantic.oas.typing import r200, r404
from virtool_core.models.index import IndexSearchResult

import virtool.indexes.db
import virtool.uploads.db
import virtool.utils

from virtool.api.response import InsufficientRights, NotFound, json_response
from virtool.data.errors import ResourceNotFoundError, ResourceConflictError
from virtool.data.utils import get_data_from_req
from virtool.history.oas import ListHistoryResponse
from virtool.http.routes import Routes
from virtool.indexes.db import FILES
from virtool.indexes.oas import (
    ListIndexesResponse,
    GetIndexResponse,
    ReadyIndexesResponse,
)
from virtool.indexes.utils import check_index_file_type, join_index_path
from virtool.references.db import check_right


logger = logging.getLogger("indexes")
routes = Routes()


@routes.view("/indexes")
class IndexesView(PydanticView):
    async def get(
        self,
    ) -> Union[r200[ListIndexesResponse], r200[List[ReadyIndexesResponse]]]:
        """
        Find indexes.

        Retrieves a list of indexes.

        Status Codes:
            200: Successful operation

        """
        data = await get_data_from_req(self.request).index.find(
            self.request.query.get("ready", False), self.request.query
        )

        if isinstance(data, IndexSearchResult):
            return json_response(ListIndexesResponse.parse_obj(data))

        return json_response([ReadyIndexesResponse.parse_obj(index) for index in data])


@routes.view("/indexes/{index_id}")
@routes.jobs_api.get("/indexes/{index_id}")
class IndexView(PydanticView):
    async def get(self) -> Union[r200[GetIndexResponse], r404]:
        """
        Get an index.

        Retrieves the details for an index.

        Status Codes:
            200: Successful operation
            404: Not found

        """
        try:
            index = await get_data_from_req(self.request).index.get(
                self.request.match_info["index_id"]
            )
        except ResourceNotFoundError:
            raise NotFound()

        return json_response(GetIndexResponse.parse_obj(index))


@routes.jobs_api.get("/indexes/{index_id}/files/otus.json.gz")
async def download_otus_json(req):
    """
    Download a complete compressed JSON representation of the index OTUs.

    """
    try:
        json_path = await get_data_from_req(req).index.get_json_path(
            req.match_info["index_id"]
        )
    except ResourceNotFoundError:
        raise NotFound()

    return FileResponse(
        json_path,
        headers={
            "Content-Disposition": "attachment; filename=otus.json.gz",
            "Content-Type": "application/octet-stream",
        },
    )


@routes.view("/indexes/{index_id}/files/{filename}")
class IndexFileView(PydanticView):
    async def get(self) -> Union[r200, r404]:
        """
        Download files relating to a given index.

        Status Codes:
            200: Successful operation
            404: Not found
        """
        index_id = self.request.match_info["index_id"]
        filename = self.request.match_info["filename"]

        if filename not in FILES:
            raise NotFound()

        try:
            reference = await get_data_from_req(self.request).index.get_reference(
                index_id
            )
        except ResourceNotFoundError:
            raise NotFound()

        # check the requesting user has read access to the parent reference
        if not await check_right(self.request, reference.dict(), "read"):
            raise InsufficientRights()

        path = (
            join_index_path(
                self.request.app["config"].data_path, reference.id, index_id
            )
            / filename
        )

        if not path.exists():
            raise NotFound("File not found")

        return FileResponse(
            path,
            headers={
                "Content-Disposition": f"attachment; filename={filename}",
                "Content-Type": "application/octet-stream",
            },
        )


@routes.jobs_api.get("/indexes/{index_id}/files/{filename}")
async def download_index_file_for_jobs(req: Request):
    """Download files relating to a given index for jobs."""
    index_id = req.match_info["index_id"]
    filename = req.match_info["filename"]

    if filename not in FILES:
        raise NotFound()

    try:
        reference = await get_data_from_req(req).index.get_reference(index_id)
    except ResourceNotFoundError:
        raise NotFound()

    path = (
        join_index_path(req.app["config"].data_path, reference.id, index_id) / filename
    )

    if not path.exists():
        raise NotFound("File not found")

    return FileResponse(path)


@routes.jobs_api.put("/indexes/{index_id}/files/{filename}")
async def upload(req):
    """Upload a new index file."""
    index_id = req.match_info["index_id"]
    name = req.match_info["filename"]

    if name not in FILES:
        raise NotFound("Index file not found")

    try:
        reference = await get_data_from_req(req).index.get_reference(index_id)
    except ResourceNotFoundError:
        raise NotFound()

    file_type = check_index_file_type(name)

    try:
        index_file = await get_data_from_req(req).index.upload_file(
            reference.id, index_id, file_type, name, req.multipart
        )
    except ResourceConflictError:
        raise HTTPConflict(text="File name already exists")

    if index_file is None:
        return Response(status=499)

    headers = {"Location": f"/indexes/{index_id}/files/{name}"}

    index_file = index_file.to_dict()

    index_file["uploaded_at"] = virtool.utils.timestamp()

    return json_response(index_file, headers=headers, status=201)


@routes.jobs_api.patch("/indexes/{index_id}")
async def finalize(req):
    """
    Finalize an index.

    Sets the `ready` flag and updates associated OTUs' `last_indexed_version` fields.

    """
    index_id = req.match_info["index_id"]

    try:
        reference = await get_data_from_req(req).index.get_reference(index_id)
    except ResourceNotFoundError:
        raise NotFound("Index does not exist")

    try:
        document = await get_data_from_req(req).index.finalize(reference.id, index_id)
    except ResourceNotFoundError:
        raise NotFound("Reference associated with index does not exist")
    except ResourceConflictError as err:
        raise HTTPConflict(text=str(err))

    return json_response(document)


@routes.view("/indexes/{index_id}/history")
class IndexHistoryView(PydanticView):
    async def get(self) -> Union[r200[ListHistoryResponse], r404]:
        """
        List history.

        Find history changes for a specific index.

        Status Codes:
            200: Successful operation
            404: Not found

        """
        try:
            data = await get_data_from_req(self.request).index.find_changes(
                self.request.match_info["index_id"], self.request.query
            )
        except ResourceNotFoundError:
            raise NotFound()

        return json_response(ListHistoryResponse.parse_obj(data))


@routes.jobs_api.delete("/indexes/{index_id}")
async def delete_index(req: Request):
    """Delete the index with the given id and reset history relating to that index."""
    index_id = req.match_info["index_id"]

    try:
        await get_data_from_req(req).index.delete(index_id)
    except ResourceNotFoundError:
        raise NotFound(f"There is no index with id: {index_id}.")

    raise HTTPNoContent
