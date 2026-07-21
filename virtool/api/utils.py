import re

from aiohttp.web_response import Response

from virtool.utils import coerce_list


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


def set_session_token_cookie(response: Response, session_token: str) -> None:
    """Set the session_token cookie with secure configuration.

    :param response: the response object to set the cookie on
    :param session_token: the session token value
    """
    _set_secure_cookie(response, "session_token", session_token)


def compose_regex_query(
    term: str,
    fields: list[str],
) -> dict[str, list[dict[str, dict]]]:
    """Compose a MongoDB query that checks if the values of the passed `fields` match
    the passed search `term`.

    :param term: the term to search
    :param fields: the list of field to match against
    :return: a query

    """
    if not isinstance(fields, (list, tuple)):
        raise TypeError("Type of 'fields' must be one of 'list' or 'tuple'")

    regex = re.compile(str(re.escape(term)), re.IGNORECASE)

    return {
        "$or": [
            {field: {"$regex": regex}}
            for field in [str(field) for field in coerce_list(fields)]
        ],
    }
