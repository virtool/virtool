import virtool.file
from virtool.handlers.utils import json_response


async def find(req):
    db = req.app["db"]

    cursor = db.files.find({}, {virtool.file.LIST_PROJECTION})

    documents = await .to_list(15)

    print(documents)


