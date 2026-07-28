from virtool.api.custom_json import json_response
from virtool.api.policy import PublicRoutePolicy, policy
from virtool.api.routes import Routes
from virtool.config import get_config_from_req
from virtool.data.utils import get_data_from_req

API_URL_ROOT = "https://www.virtool.ca/docs/api"

routes = Routes()


@routes.get("/")
@routes.jobs_api.get("/")
@policy(PublicRoutePolicy)
async def get(req):
    """Returns a generic message. Used during testing for acquiring a ``session_id``."""
    first_user = not await get_data_from_req(req).users.check_users_exist()

    app_data = {
        "dev": get_config_from_req(req).dev,
        "first_user": first_user,
        "endpoints": {
            "authentication": {
                "url": "/overview/authentication",
                "doc": f"{API_URL_ROOT}/overview/authentication",
            },
            "errors": {
                "url": "/overview/errors",
                "doc": f"{API_URL_ROOT}/overview/errors",
            },
            "indexes": {"url": "/indexes", "doc": f"{API_URL_ROOT}/indexes"},
            "samples": {"url": "/samples", "doc": f"{API_URL_ROOT}/samples"},
        },
    }

    try:
        app_data["version"] = req.app["version"]
    except KeyError:
        pass

    return json_response(app_data)
