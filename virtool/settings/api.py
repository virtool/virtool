from aiohttp.web import Request, Response
from aiohttp_pydantic import PydanticView
from aiohttp_pydantic.oas.typing import r200, r403

from virtool.api.custom_json import json_response
from virtool.api.policy import AdministratorRoutePolicy, policy
from virtool.api.routes import Routes
from virtool.data.utils import get_data_from_req
from virtool.models.roles import AdministratorRole
from virtool.settings.models import Settings
from virtool.settings.oas import (
    UpdateSettingsRequest,
)

routes = Routes()


@routes.view("/settings")
class SettingsView(PydanticView):
    async def get(self) -> r200[Settings]:
        """Get settings.

        Fetches the complete application settings.

        Status Codes:
            200: Successful operation
        """
        settings = await get_data_from_req(self.request).settings.get_all()

        return json_response(settings)

    @policy(AdministratorRoutePolicy(AdministratorRole.SETTINGS))
    async def patch(self, data: UpdateSettingsRequest) -> r200[Settings] | r403:
        """Update settings.

        Updates the application settings.

        Status Codes:
            200: Successful operation
            403: Not permitted
        """
        settings = await get_data_from_req(self.request).settings.update(data)

        return json_response(settings)


@routes.jobs_api.get("/settings")
async def get(req: Request) -> Response:
    """Get settings.

    Fetches a complete document of the application settings.
    """
    settings = await get_data_from_req(req).settings.get_all()

    return json_response(settings)
