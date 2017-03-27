from aiohttp import web
from virtool.data.analyses import format_analyses


async def get_analysis(req):
    """
    Get a complete analysis document.
    
    """
    analysis_id = req.match_info["analysis_id"]

    document = await req["db"].find_one(analysis_id)

    if document:
        return web.json_response(await format_analyses(document))

    return web.json_response({"message": "Not found"}, status=404)


async def remove_analysis(req):
    """
    Remove an analysis document

    """
    document = await db.analyses.find_one_and_remove({"_id": analysis_id})

    sample_id = document["sample_id"]

    await db.samples.

    id_list = coerce_list(transaction.data["_id"])

    for _id in id_list:
        yield self.remove_by_id(_id)

    return True, None