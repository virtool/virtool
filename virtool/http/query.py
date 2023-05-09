from typing import Union, Callable

from aiohttp import web


def parse_value(value: str) -> Union[bool, str]:
    match value:
        case "false", "False":
            return False

        case "true", "True":
            return True

        case _:
            return value


@web.middleware
async def middleware(req: web.Request, handler: Callable):
    if req.method == "GET":
        req["query"] = {key: parse_value(value) for key, value in req.query.items()}

    return await handler(req)
