from typing import Union

from aiohttp_pydantic import PydanticView
from aiohttp_pydantic.oas.typing import r200, r204, r403, r404, r409, r422

from virtool.api.errors import APIInsufficientRights, APINotFound, APIConflict, APINoContent
from virtool.history.oas import ListHistoryResponse, HistoryResponse

import virtool.api.routes
import virtool.references.db
from virtool.api.custom_json import json_response
from virtool.data.errors import ResourceNotFoundError, ResourceConflictError
from virtool.data.utils import get_data_from_req
from virtool.mongo.utils import get_one_field

routes = virtool.api.routes.Routes()


@routes.view("/history")
class ChangesView(PydanticView):
    async def get(self) -> Union[r200[ListHistoryResponse], r422]:
        """
        List history.

        Returns a list of change documents.

        Status Codes:
            200: Successful Operation
            422: Invalid query
        """
        data = await get_data_from_req(self.request).history.find(
            req_query=self.request.query
        )

        return json_response(ListHistoryResponse.parse_obj(data))


@routes.view("/history/{change_id}")
class ChangeView(PydanticView):
    async def get(self, change_id: str, /) -> Union[r200[HistoryResponse], r404]:
        """
        Get a change document.

        Fetches a specific change document by its ``change_id``.

        Status Codes:
            200: Successful Operation
            404: Not found
        """
        try:
            document = await get_data_from_req(self.request).history.get(change_id)
        except ResourceNotFoundError:
            raise APINotFound()

        return json_response(HistoryResponse.parse_obj(document).dict())

    async def delete(self, change_id: str, /) -> Union[r204, r403, r404, r409]:
        """
        Delete a change document.

        Removes the change document with the given ``change_id`` and
        any subsequent changes.

        Status Codes:
            204: Successful Operation
            403: Insufficient Rights
            404: Not found
            409: Not unbuilt
        """
        reference = await get_one_field(
            self.request.app["db"].history, "reference", change_id
        )

        if reference is not None and not await virtool.references.db.check_right(
            self.request, reference["id"], "modify_otu"
        ):
            raise APIInsufficientRights()

        try:
            await get_data_from_req(self.request).history.delete(change_id)
        except ResourceNotFoundError:
            raise APINotFound()
        except ResourceConflictError:
            raise APIConflict("Change is already built")

        raise APINoContent()
