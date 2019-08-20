import aiohttp.web


async def check_password_length(req: aiohttp.web.Request):
    """
    Return error text if the password in the request does not meet application length requirements.

    """
    minimum_password_length = req.app["settings"]["minimum_password_length"]

    if len(req["data"]["password"]) < minimum_password_length:
        return f"Password does not meet minimum length requirement ({minimum_password_length})"
