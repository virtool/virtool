import virtool.file
from virtool.handlers.utils import json_response


async def find(req):
    db = req.app["db"]

    cursor = db.files.find({"eof": True}, virtool.file.LIST_PROJECTION)

    found_count = await cursor.count()

    documents = [virtool.file.processor(d) for d in await cursor.to_list(15)]

    return json_response({
        "documents": documents,
        "found_count": found_count
    })
