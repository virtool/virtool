from virtool.api.response import json_response
from virtool.http.routes import Routes

API_URL_ROOT = "https://www.virtool.ca/docs/developer/api"

routes = Routes()


@routes.get("/", public=True)
@routes.jobs_api.get("/")
async def get(req):
    """
    Returns a generic message. Used during testing for acquiring a ``session_id``.

    """
    first_user = await req.app["db"].users.count_documents({}) == 0

    app_data = {
        "dev": req.app["config"].dev,
        "first_user": first_user,
        "endpoints": {
            "account": {"url": "/account", "doc": f"{API_URL_ROOT}/account"},
            "analyses": {"url": "/analyses", "doc": f"{API_URL_ROOT}/analyses"},
            "genbank": {"url": "/genbank", "doc": f"{API_URL_ROOT}/genbank"},
            "groups": {"url": "/groups", "doc": f"{API_URL_ROOT}/groups"},
            "history": {"url": "/history", "doc": f"{API_URL_ROOT}/history"},
            "hmm": {"url": "/hmm", "doc": f"{API_URL_ROOT}/hmm"},
            "indexes": {"url": "/indexes", "doc": f"{API_URL_ROOT}/indexes"},
            "jobs": {"url": "/jobs", "doc": f"{API_URL_ROOT}/jobs"},
            "otus": {"url": "/otus", "doc": f"{API_URL_ROOT}/otus"},
            "references": {"url": "/references", "doc": f"{API_URL_ROOT}/refs"},
            "samples": {"url": "/samples", "doc": f"{API_URL_ROOT}/samples"},
            "settings": {"url": "/settings", "doc": f"{API_URL_ROOT}/settings"},
            "subtraction": {
                "url": "/subtraction",
                "doc": f"{API_URL_ROOT}/subtraction",
            },
            "tasks": {"url": "/tasks", "doc": f"{API_URL_ROOT}/tasks"},
            "users": {"url": "/users", "doc": f"{API_URL_ROOT}/users"},
        },
    }

    try:
        app_data["version"] = req.app["version"]
    except KeyError:
        pass

    return json_response(app_data)
