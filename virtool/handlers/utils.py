from aiohttp import web


async def unpack_json_request(req):
    return req.app["db"], await req.json()


def not_found():
    return web.json_response({"message": "Not found"}, status=404)


def requires_login():
    return web.json_response({"message": "Requires login"}, status=400)


def invalid_input(errors):
    return web.json_response({"message": "Invalid input", "errors": errors}, status=422)
