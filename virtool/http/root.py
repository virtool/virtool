import virtool.http.routes
from virtool.api.response import json_response

API_URL_ROOT = "https://www.virtool.ca/docs/developer/api"

routes = virtool.http.routes.Routes()


@routes.get("/api")
@routes.jobs_api.get("/api")
async def get(req):
    """
    Returns a generic message. Used during testing for acquiring a ``session_id``.

    """
    app_data = {"endpoints": {
            "account": {
                "url": "/api/account",
                "doc": f"{API_URL_ROOT}/account"
            },
            "analyses": {
                "url": "/api/analyses",
                "doc": f"{API_URL_ROOT}/analyses"
            },
            "genbank": {
                "url": "/api/genbank",
                "doc": f"{API_URL_ROOT}/genbank"
            },
            "groups": {
                "url": "/api/groups",
                "doc": f"{API_URL_ROOT}/groups"
            },
            "history": {
                "url": "/api/history",
                "doc": f"{API_URL_ROOT}/history"
            },
            "hmm": {
                "url": "/api/hmm",
                "doc": f"{API_URL_ROOT}/hmm"
            },
            "indexes": {
                "url": "/api/indexes",
                "doc": f"{API_URL_ROOT}/indexes"
            },
            "jobs": {
                "url": "/api/jobs",
                "doc": f"{API_URL_ROOT}/jobs"
            },
            "otus": {
                "url": "/api/otus",
                "doc": f"{API_URL_ROOT}/otus"
            },
            "references": {
                "url": "/api/references",
                "doc": f"{API_URL_ROOT}/refs"
            },
            "samples": {
                "url": "/api/samples",
                "doc": f"{API_URL_ROOT}/samples"
            },
            "settings": {
                "url": "/api/settings",
                "doc": f"{API_URL_ROOT}/settings"
            },
            "subtraction": {
                "url": "/api/subtraction",
                "doc": f"{API_URL_ROOT}/subtraction"
            },
            "tasks": {
                "url": "/api/tasks",
                "doc": f"{API_URL_ROOT}/tasks"
            },
            "users": {
                "url": "/api/users",
                "doc": f"{API_URL_ROOT}/users"
            }},
        "dev": req.app["config"].dev
    }

    try:
        app_data["version"] = req.app["version"]
    except KeyError:
        pass

    return json_response(app_data)
