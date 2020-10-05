import virtool.http.routes
from virtool.api.response import json_response

API_URL_ROOT = "https://www.virtool.ca/docs/developer/api"

routes = virtool.http.routes.Routes()


@routes.get("/api")
async def get(req):
    """
    Returns a generic message. Used during testing for acquiring a ``session_id``.

    """
    return json_response({
        "endpoints": {
            "account": {
                "url": "/api/account",
                "doc": f"{API_URL_ROOT}_account.html"
            },
            "analyses": {
                "url": "/api/analyses",
                "doc": f"{API_URL_ROOT}_analyses.html"
            },
            "genbank": {
                "url": "/api/genbank",
                "doc": f"{API_URL_ROOT}_genbank.html"
            },
            "groups": {
                "url": "/api/groups",
                "doc": f"{API_URL_ROOT}_groups.html"
            },
            "history": {
                "url": "/api/history",
                "doc": f"{API_URL_ROOT}_history.html"
            },
            "hmm": {
                "url": "/api/hmm",
                "doc": f"{API_URL_ROOT}_hmm.html"
            },
            "indexes": {
                "url": "/api/indexes",
                "doc": f"{API_URL_ROOT}_indexes.html"
            },
            "jobs": {
                "url": "/api/jobs",
                "doc": f"{API_URL_ROOT}_jobs.html"
            },
            "otus": {
                "url": "/api/otus",
                "doc": f"{API_URL_ROOT}_otus.html"
            },
            "references": {
                "url": "/api/references",
                "doc": f"{API_URL_ROOT}_references.html"
            },
            "samples": {
                "url": "/api/samples",
                "doc": f"{API_URL_ROOT}_samples.html"
            },
            "settings": {
                "url": "/api/settings",
                "doc": f"{API_URL_ROOT}_settings.html"
            },
            "subtraction": {
                "url": "/api/subtraction",
                "doc": f"{API_URL_ROOT}_subtraction.html"
            },
            "tasks": {
                "url": "/api/tasks",
                "doc": f"{API_URL_ROOT}_tasks.html"
            },
            "users": {
                "url": "/api/users",
                "doc": f"{API_URL_ROOT}_users.html"
            }
        },
        "version": req.app["version"]
    })
