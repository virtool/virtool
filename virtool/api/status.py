import virtool.http.routes
from virtool.api.utils import json_response

routes = virtool.http.routes.Routes()


def status_processor(document):
    document["id"] = document.pop("_id")
    return document


@routes.get("/api/status")
async def list_status(req):
    status_documents = await req.app["db"].status.find().to_list(None)
    return json_response([status_processor(d) for d in status_documents])
