from aiohttp.web import Request


async def check_password_length(req: Request, password: str) -> str:
    """
    Return error text if the password in the request does not meet
    application length requirements.

    """
    minimum_password_length = req.app["settings"].minimum_password_length

    if len(password) < minimum_password_length:
        return f"Password does not meet minimum length requirement ({minimum_password_length})"
