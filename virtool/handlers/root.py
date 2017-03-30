from aiohttp import web


async def get(req):
    """
    Returns a generic message. Used during testing for acquiring a ``session_id``.
         
    """
    return web.json_response({
        "status": "healthy"
    })
