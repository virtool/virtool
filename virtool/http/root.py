import virtool.http.routes
from virtool.api import json_response

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
                "doc": "https://www.virtool.ca/docs/api/account.html"
            },
            "analyses": {
                "url": "/api/account",
                "doc": "https://www.virtool.ca/docs/api/analyses.html"
            },
            "genbank": {
                "url": "/api/jobs",
                "doc": "https://www.virtool.ca/docs/api/genbank.html"
            },
            "groups": {
                "url": "/api/jobs",
                "doc": "https://www.virtool.ca/docs/api/groups.html"
            },
            "hmm": {
                "url": "/api/jobs",
                "doc": "https://www.virtool.ca/docs/api/hmm.html"
            },
            "history": {
                "url": "/api/jobs",
                "doc": "https://www.virtool.ca/docs/api/history.html"
            },
            "indexes": {
                "url": "/api/jobs",
                "doc": "https://www.virtool.ca/docs/api/indexes.html"
            },
            "jobs": {
                "url": "/api/jobs",
                "doc": "https://www.virtool.ca/docs/api/jobs.html"
            },
            "otus": {
                "url": "/api/otus",
                "doc": "https://www.virtool.ca/docs/api/otus.html"
            },
            "processes": {
                "url": "/api/otus",
                "doc": "https://www.virtool.ca/docs/api/processes.html"
            },
            "references": {
                "url": "/api/references",
                "doc": "https://www.virtool.ca/docs/api/references.html"
            },
            "samples": {
                "url": "/api/samples",
                "doc": "https://www.virtool.ca/docs/api/samples.html"
            },
            "settings": {
                "url": "/api/samples",
                "doc": "https://www.virtool.ca/docs/api/settings.html"
            },
            "subtraction": {
                "url": "/api/samples",
                "doc": "https://www.virtool.ca/docs/api/subtraction.html"
            },
            "users": {
                "url": "/api/samples",
                "doc": "https://www.virtool.ca/docs/api/users.html"
            }
        },
        "version": req.app["version"]
    })
