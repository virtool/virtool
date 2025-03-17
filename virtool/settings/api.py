from virtool_core.models.roles import AdministratorRole

from virtool.api.custom_json import json_response
from virtool.api.policy import AdministratorRoutePolicy, policy
from virtool.api.routes import Routes
from virtool.api.status import R200, R403
from virtool.api.view import APIView
from virtool.settings.oas import (
    SettingsResponse,
    SettingsUpdateRequest,
)

routes = Routes()


@routes.job.get("/settings")
@routes.web.view("/settings")
class SettingsView(APIView):
    async def get(self) -> R200[SettingsResponse]:
        """Get settings.

        Fetches the complete application settings.

        Status Codes:
            200: Successful operation
        """
        settings = await self.data.settings.get_all()
        return json_response(settings)

    @policy(AdministratorRoutePolicy(AdministratorRole.SETTINGS))
    async def patch(
        self,
        data: SettingsUpdateRequest,
    ) -> R200[SettingsResponse] | R403:
        """Update settings.

        Updates the application settings.

        Status Codes:
            200: Successful operation
            403: Not permitted
        """
        settings = await self.data.settings.update(data)

        return json_response(settings)
