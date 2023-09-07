from virtool.api.response import json_response
from virtool.config import get_config_from_req
from virtool.http.policy import policy, PublicRoutePolicy
from virtool.http.routes import Routes
from virtool.data.utils import get_data_from_req

API_URL_ROOT = "https://www.virtool.ca/docs/api"

routes = Routes()


@routes.get("/")
@routes.jobs_api.get("/")
@policy(PublicRoutePolicy)
async def get(req):
    """
    Returns a generic message. Used during testing for acquiring a ``session_id``.

    """
    first_user = not await get_data_from_req(req).users.check_users_exist()

    app_data = {
        "dev": get_config_from_req(req).dev,
        "first_user": first_user,
        "endpoints": {
            "account": {"url": "/account", "doc": f"{API_URL_ROOT}/account"},
            "admin": {"url": "/admin", "doc": f"{API_URL_ROOT}/admin"},
            "analyses": {"url": "/analyses", "doc": f"{API_URL_ROOT}/analyses"},
            "groups": {"url": "/groups", "doc": f"{API_URL_ROOT}/groups"},
            "history": {"url": "/history", "doc": f"{API_URL_ROOT}/history"},
            "hmms": {"url": "/hmms", "doc": f"{API_URL_ROOT}/hmms"},
            "indexes": {"url": "/indexes", "doc": f"{API_URL_ROOT}/indexes"},
            "jobs": {"url": "/jobs", "doc": f"{API_URL_ROOT}/jobs"},
            "labels": {"url": "/labels", "doc": f"{API_URL_ROOT}/labels"},
            "ml": {"url": "/ml", "doc": f"{API_URL_ROOT}/ml"},
            "otus": {"url": "/otus", "doc": f"{API_URL_ROOT}/otus"},
            "references": {"url": "/references", "doc": f"{API_URL_ROOT}/refs"},
            "samples": {"url": "/samples", "doc": f"{API_URL_ROOT}/samples"},
            "settings": {"url": "/settings", "doc": f"{API_URL_ROOT}/settings"},
            "spaces": {"url": "/spaces", "doc": f"{API_URL_ROOT}/spaces"},
            "subtraction": {
                "url": "/subtraction",
                "doc": f"{API_URL_ROOT}/subtraction",
            },
            "tasks": {"url": "/tasks", "doc": f"{API_URL_ROOT}/tasks"},
            "uploads": {"url": "/uploads", "doc": f"{API_URL_ROOT}/uploads"},
            "users": {"url": "/users", "doc": f"{API_URL_ROOT}/users"},
        },
    }

    try:
        app_data["version"] = req.app["version"]
    except KeyError:
        pass

    return json_response(app_data)
