from aiohttp.web import Request

from virtool.data.utils import get_data_from_req


async def check_password_length(req: Request, password: str) -> str:
    """
    Return error text if the password in the request does not meet
    application length requirements.

    """
    settings = await get_data_from_req(req).settings.get_all()
    minimum_password_length = settings.minimum_password_length

    if len(password) < minimum_password_length:
        return f"Password does not meet minimum length requirement ({minimum_password_length})"
