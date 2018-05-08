from aiohttp import web


def parse_value(value):
    if value == "false" or value == "False":
        return False

    if value == "true" or value == "True":
        return True

    return value


@web.middleware
def middleware(req, handler):
    if req.method == "GET":
        req["query"] = {key: parse_value(value) for key, value in req.query.items()}

    return handler(req)
