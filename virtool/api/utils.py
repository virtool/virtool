from aiohttp.web_response import Response


def _set_secure_cookie(response: Response, name: str, value: str) -> None:
    """Set a secure cookie with HttpOnly, Secure, SameSite=Lax, and proper path.

    :param response: the response object to set the cookie on
    :param name: the name of the cookie
    :param value: the value of the cookie
    """
    response.set_cookie(
        name,
        value,
        httponly=True,
        secure=True,
        samesite="Lax",
        path="/",
        max_age=2600000,
    )


def set_session_id_cookie(response: Response, session_id: str) -> None:
    """Set the session_id cookie with secure configuration.

    :param response: the response object to set the cookie on
    :param session_id: the session ID value
    """
    _set_secure_cookie(response, "session_id", session_id)
