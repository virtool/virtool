from aiohttp import web
from aiohttp.web import Request, Response

from virtool.api.authentication import get_ip
from virtool.api.utils import set_session_id_cookie
from virtool.data.errors import (
    ResourceNotFoundError,
)
from virtool.data.utils import get_data_from_req
from virtool.models.sessions import Session
from virtool.utils import get_safely


@web.middleware
async def session_middleware(req: Request, handler) -> Response:
    session = await get_session(req)

    if not session:
        session = await get_data_from_req(req).sessions.create_anonymous(get_ip(req))

    req["session"] = session

    resp = await handler(req)

    if not resp.cookies.get("session_id"):
        set_session_id_cookie(resp, req["session"].id)

    if not req["session"].authentication and not resp.cookies.get("session_token"):
        resp.del_cookie("session_token")

    return resp


async def get_session(req: Request) -> Session | None:
    session_id = req.cookies.get("session_id")
    session_token = req.cookies.get("session_token")
    sessions_data = get_data_from_req(req).sessions

    try:
        if session_id:
            if session_token:
                return await sessions_data.get_authenticated(session_id, session_token)

            if req.path == "/account/reset":
                body = await req.json()
                reset_code = get_safely(body, "reset_code")

                return await sessions_data.get_reset(session_id, reset_code)

            return await sessions_data.get_anonymous(session_id)
    except ResourceNotFoundError:
        return None
