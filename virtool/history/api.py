import virtool.api.routes
import virtool.references.db
from virtool.api.custom_json import json_response
from virtool.api.errors import (
    APIConflict,
    APIInsufficientRights,
    APINoContent,
    APINotFound,
)
from virtool.api.status import R200, R204, R403, R404, R409, R422
from virtool.api.view import APIView
from virtool.data.errors import ResourceConflictError, ResourceNotFoundError
from virtool.history.oas import HistoryResponse, HistorySearchResponse
from virtool.mongo.utils import get_mongo_from_req, get_one_field

routes = virtool.api.routes.Routes()


@routes.web.view("/history")
class ChangesView(APIView):
    async def get(self) -> R200[HistorySearchResponse] | R422:
        """List history.

        Returns a list of change documents.

        Status Codes:
            200: Successful Operation
            422: Invalid query
        """
        data = await self.data.history.find(
            req_query=self.request.query,
        )

        return json_response(HistorySearchResponse.model_validate(data))


@routes.web.view("/history/{change_id}")
class ChangeView(APIView):
    async def get(self, change_id: str, /) -> R200[HistoryResponse] | R404:
        """Get a change document.

        Fetches a specific change document by its ``change_id``.

        Status Codes:
            200: Successful Operation
            404: Not found
        """
        try:
            document = await self.data.history.get(change_id)
        except ResourceNotFoundError:
            raise APINotFound()

        return json_response(HistoryResponse.model_validate(document))

    async def delete(self, change_id: str, /) -> R204 | R403 | R404 | R409:
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
            await self.data.history.delete(change_id)
        except ResourceNotFoundError:
            raise APINotFound()
        except ResourceConflictError:
            raise APIConflict("Change is already built")

        raise APINoContent()
