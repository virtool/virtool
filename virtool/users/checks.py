from virtool.data.utils import get_data_from_req
from aiohttp.web import Request


async def check_password_length(req: Request, password: str) -> str:
    """
    Return error text if the password in the request does not meet application length
    requirements.
    """
    settings = await get_data_from_req(req).settings.get_all()

    if len(password) < settings.minimum_password_length:
        return f"Password does not meet minimum length requirement ({settings.minimum_password_length})"
