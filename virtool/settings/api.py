from typing import Union

from aiohttp.web import Request, Response
from aiohttp_pydantic import PydanticView
from aiohttp_pydantic.oas.typing import r200, r403

import virtool.settings.db
from virtool.api.response import json_response
from virtool.http.policy import policy, AdministratorRoutePolicy
from virtool.http.routes import Routes
from virtool.settings.db import Settings
from virtool.settings.oas import (
    GetSettingsResponse,
    UpdateSettingsResponse,
    UpdateSettingsSchema,
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
        settings = await virtool.settings.db.get(self.request.app["db"])

        return json_response(settings)

    @policy(AdministratorRoutePolicy)
    async def patch(
        self, data: UpdateSettingsSchema
    ) -> Union[r200[UpdateSettingsResponse], r403]:
        """
        Update settings.

        Updates the application settings.

        Status Codes:
            200: Successful operation
            403: Not permitted
        """
        settings = await virtool.settings.db.update(
            self.request.app["db"], data.dict(exclude_unset=True)
        )

        settings.pop("software_channel", None)

        self.request.app["settings"] = Settings(**settings)

        return json_response(settings)


@routes.jobs_api.get("/settings")
async def get(req: Request) -> Response:
    """
    Get a complete document of the application settings.

    """
    settings = await virtool.settings.db.get(req.app["db"])

    return json_response(settings)
