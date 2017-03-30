async def unpack_json_request(req):
    return req.app["db"], await req.json()
