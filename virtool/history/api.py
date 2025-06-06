from aiohttp_pydantic import PydanticView
from aiohttp_pydantic.oas.typing import r200, r204, r403, r404, r409, r422

import virtool.api.routes
import virtool.references.db
from virtool.api.custom_json import json_response
from virtool.api.errors import (
    APIConflict,
    APIInsufficientRights,
    APINoContent,
    APINotFound,
)
from virtool.data.errors import ResourceConflictError, ResourceNotFoundError
from virtool.data.utils import get_data_from_req
from virtool.history.models import History, HistorySearchResult
from virtool.mongo.utils import get_mongo_from_req, get_one_field

routes = virtool.api.routes.Routes()


@routes.view("/history")
class ChangesView(PydanticView):
    async def get(self) -> r200[HistorySearchResult] | r422:
        """List history.

        Returns a list of change documents.

        Status Codes:
            200: Successful Operation
            422: Invalid query
        """
        data = await get_data_from_req(self.request).history.find(
            req_query=self.request.query,
        )

        return json_response(data)


@routes.view("/history/{change_id}")
class ChangeView(PydanticView):
    async def get(self, change_id: str, /) -> r200[History] | r404:
        """Get a change document.

        Fetches a specific change document by its ``change_id``.

        Status Codes:
            200: Successful Operation
            404: Not found
        """
        try:
            history = await get_data_from_req(self.request).history.get(change_id)
        except ResourceNotFoundError:
            raise APINotFound()

        return json_response(history)

    async def delete(self, change_id: str, /) -> r204 | r403 | r404 | r409:
        """Delete a change document.

        Removes the change document with the given ``change_id`` and
        any subsequent changes.

        Status Codes:
            204: Successful Operation
            403: Insufficient Rights
            404: Not found
            409: Not unbuilt
        """
        reference = await get_one_field(
            get_mongo_from_req(self.request).history,
            "reference",
            change_id,
        )

        if reference is not None and not await virtool.references.db.check_right(
            self.request,
            reference["id"],
            "modify_otu",
        ):
            raise APIInsufficientRights()

        try:
            await get_data_from_req(self.request).history.delete(change_id)
        except ResourceNotFoundError:
            raise APINotFound()
        except ResourceConflictError:
            raise APIConflict("Change is already built")

        raise APINoContent()
