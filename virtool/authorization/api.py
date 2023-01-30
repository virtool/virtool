from typing import Optional

from aiohttp_pydantic import PydanticView
from aiohttp_pydantic.oas.typing import r200

from virtool.api.response import json_response
from virtool.authorization.permissions import ResourceType
from virtool.authorization.oas import ListPermissionsResponse
from virtool.data.utils import get_data_from_req
from virtool.http.routes import Routes

routes = Routes()


@routes.view("/source/permissions")
class SourceView(PydanticView):
    async def get(self) -> r200[ListPermissionsResponse]:
        """
        List permissions.

        Lists all Virtool permissions.

        The list can be filtered by resource type using the `resource_type` query
        parameter.

        Status Codes:
            200: Successful operation
        """
        return json_response(
            await get_data_from_req(self.request).auth.find(resource_type)
        )
