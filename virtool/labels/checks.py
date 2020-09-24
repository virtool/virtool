import aiohttp.web
import re


async def check_hex_color(req: aiohttp.web.Request):
    """
    Check if the Hex color in the request is valid.

    """
    regex = "^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$"

    match = re.match(regex, req["data"]["color"])

    return match
