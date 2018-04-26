import virtool.http.routes
import virtool.utils
from virtool.api.utils import json_response

routes = virtool.http.routes.Routes()


@routes.get("/api/processes")
async def find(req):
    db = req.app["db"]

    documents = [virtool.utils.base_processor(d) async for d in db.processes.find()]

    return json_response(documents)


@routes.get("/api/processes/{process_id}")
async def get(req):
    db = req.app["db"]

    process_id = req.match_info["process_id"]

    document = await db.processes.find_one(process_id)

    return json_response(virtool.utils.base_processor(document))


@routes.get("/api/processes/software_update")
async def get_software_update(req):
    db = req.app["db"]

    document = await db.processes.find_one({"type": "software_update"})

    return json_response(virtool.utils.base_processor(document))


@routes.get("/api/processes/hmm_install")
async def get_hmm_install(req):
    db = req.app["db"]

    document = await db.processes.find_one({"type": "hmm_install"})

    return json_response(virtool.utils.base_processor(document))
