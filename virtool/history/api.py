from aiohttp_pydantic import PydanticView
from aiohttp_pydantic.oas.typing import r200, r400, r404

import virtool.api.routes
from virtool.api.custom_json import json_response
from virtool.api.errors import APINotFound
from virtool.api.pagination import Page, PerPage
from virtool.data.errors import ResourceNotFoundError
from virtool.data.utils import get_data_from_req
from virtool.history.models import History, HistorySearchResult

routes = virtool.api.routes.Routes()


@routes.view("/history")
class ChangesView(PydanticView):
    async def get(
        self,
        page: Page = 1,
        per_page: PerPage = 25,
    ) -> r200[HistorySearchResult] | r400:
        """List history.

        Returns a list of change documents.

        Status Codes:
            200: Successful Operation
            400: Invalid query
        """
        data = await get_data_from_req(self.request).history.find(page, per_page)

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
