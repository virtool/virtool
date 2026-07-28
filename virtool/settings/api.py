from aiohttp.web import Request, Response

from virtool.api.custom_json import json_response
from virtool.api.routes import Routes
from virtool.data.utils import get_data_from_req

routes = Routes()


@routes.jobs_api.get("/settings")
async def get(req: Request) -> Response:
    """Get settings.

    Fetches a complete document of the application settings.
    """
    settings = await get_data_from_req(req).settings.get_all()

    return json_response(settings)
