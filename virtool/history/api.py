from typing import Union, List

from aiohttp.web import HTTPConflict, HTTPNoContent
from aiohttp_pydantic import PydanticView
from aiohttp_pydantic.oas.typing import r200, r204, r403, r404, r409, r422
from virtool.history.oas import GetHistoryResponse, HistoryResponse

import virtool.http.routes
import virtool.references.db
from virtool.api.response import InsufficientRights, NotFound, json_response
from virtool.data.errors import ResourceNotFoundError, ResourceConflictError
from virtool.data.utils import get_data_from_req
from virtool.mongo.utils import get_one_field

routes = virtool.http.routes.Routes()


@routes.view("/history")
class ChangesView(PydanticView):
    async def get(self) -> Union[r200[List[GetHistoryResponse]], r422]:
        """
        Get a list of change documents.
        Status Codes:
            200: Successful Operation
            422: Invalid query
        """
        data = await get_data_from_req(self.request).history.find(
            req_query=self.request.query
        )

        return json_response(
            [
                GetHistoryResponse.parse_obj(document).dict()
                for document in data.documents
            ]
        )


@routes.view("/history/{change_id}")
class ChangeView(PydanticView):
    async def get(self) -> Union[r200[HistoryResponse], r404]:
        """
        Get a specific change document by its ``change_id``.
        Status Codes:
            200: Successful Operation
            404: Not found
        """
        change_id = self.request.match_info["change_id"]

        try:
            document = await get_data_from_req(self.request).history.get(change_id)
        except ResourceNotFoundError:
            raise NotFound()

        return json_response(HistoryResponse.parse_obj(document).dict())

    async def delete(self) -> Union[r204, r403, r404, r409]:
        """
        Remove the change document with the given ``change_id`` and
        any subsequent changes.
        Status Codes:
            204: Successful Operation
            403: Insufficient Rights
            404: Not found
            409: Not unbuilt
        """
        change_id = self.request.match_info["change_id"]

        reference = await get_one_field(
            self.request.app["db"].history, "reference", change_id
        )

        if reference is not None and not await virtool.references.db.check_right(
            self.request, reference["id"], "modify_otu"
        ):

            raise InsufficientRights()

        try:
            await get_data_from_req(self.request).history.delete(change_id)
        except ResourceNotFoundError:
            raise NotFound()
        except ResourceConflictError:
            raise HTTPConflict(text="Change is already built")

        raise HTTPNoContent
