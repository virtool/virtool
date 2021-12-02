import virtool.settings.db
from aiohttp.web import Request, Response
from virtool.api.response import json_response
from virtool.http.routes import Routes
from virtool.http.schema import schema
from virtool.settings.db import Settings
from virtool.settings.schema import SCHEMA

routes = Routes()


@routes.get("/settings")
@routes.jobs_api.get("/settings")
async def get(req: Request) -> Response:
    """
    Get a complete document of the application settings.

    """
    settings = await virtool.settings.db.get(req.app["db"])

    return json_response(settings)


@routes.patch("/settings", admin=True)
@schema(SCHEMA)
async def update(req: Request) -> Response:
    """
    Update application settings based on request data.

    """
    raw_data = await req.json()

    data = {key: req["data"][key] for key in raw_data}

    settings = await virtool.settings.db.update(req.app["db"], data)

    req.app["settings"] = Settings(**settings)

    return json_response(settings)
