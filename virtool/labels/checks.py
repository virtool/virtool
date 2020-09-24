import aiohttp.web
import re


async def check_hex_color(req: aiohttp.web.Request):
    """
    Return error text if the Hex color in the request is not valid.

    """
    regex = "^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$"

    match = re.match(regex, req["data"]["color"])

    return match
