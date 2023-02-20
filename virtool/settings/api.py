from typing import Union

from aiohttp.web import Request, Response
from aiohttp_pydantic import PydanticView
from aiohttp_pydantic.oas.typing import r200, r403

from virtool.api.response import json_response
from virtool_core.models.roles import AdministratorRole
from virtool.data.utils import get_data_from_req
from virtool.http.policy import policy, AdministratorRoutePolicy
from virtool.http.routes import Routes
from virtool.settings.oas import (
    GetSettingsResponse,
    UpdateSettingsResponse,
    UpdateSettingsRequest,
)

routes = Routes()


@routes.view("/settings")
class SettingsView(PydanticView):
    async def get(self) -> r200[GetSettingsResponse]:
        """
        Get settings.

        Returns the complete application settings.

        Status Codes:
            200: Successful operation
        """
        settings = await get_data_from_req(self.request).settings.get_all()

        return json_response(settings)

    @policy(AdministratorRoutePolicy(AdministratorRole.SETTINGS))
    async def patch(
        self, data: UpdateSettingsRequest
    ) -> Union[r200[UpdateSettingsResponse], r403]:
        """
        Update settings.

        Updates the application settings.

        Status Codes:
            200: Successful operation
            403: Not permitted
        """
        settings = await get_data_from_req(self.request).settings.update(data)

        return json_response(settings)


@routes.jobs_api.get("/settings")
async def get(req: Request) -> Response:
    """
    Get a complete document of the application settings.

    """
    settings = await get_data_from_req(req).settings.get_all()

    return json_response(settings)
