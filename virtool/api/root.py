import virtool.http.routes
from virtool.api.utils import json_response

routes = virtool.http.routes.Routes()


@routes.get("/")
async def get(req):
    """
    Returns a generic message. Used during testing for acquiring a ``session_id``.

    """
    return json_response({
        "endpoints": {
            "account": {
                "url": "/api/account",
                "doc": "https://docs.virtool.ca/web-api/account.html"
            },

            "jobs": {
                "url": "/api/jobs",
                "doc": "https://docs.virtool.ca/web-api/jobs.html"
            },

            "samples": {
                "url": "/api/samples",
                "doc": "https://docs.virtool.ca/web-api/samples.html"
            },

            "analyses": {
                "url": "/api/analyses",
                "doc": "https://docs.virtool.ca/web-api/analyses.html"
            },

            "kinds": {
                "url": "/api/kinds",
                "doc": "https://docs.virtool.ca/web-api/kinds.html"
            }
        }
    })
