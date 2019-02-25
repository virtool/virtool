import base64
import os
import sys
import urllib.parse

import mako.template
from aiohttp import web

import virtool.app_routes
import virtool.db.sessions
import virtool.db.users
import virtool.db.utils
import virtool.errors
import virtool.users
import virtool.utils
from virtool.api.utils import bad_request

AUTHORIZATION_PROJECTION = [
    "user",
    "administrator",
    "groups",
    "permissions"
]


class Client:

    def __init__(self, ip):
        # These attributes are assigned even when the session is not authorized.
        self.ip = ip

        self.administrator = None
        self.authorized = False
        self.user_id = None
        self.groups = None
        self.permissions = None
        self.is_api = False
        self.session_id = None
        self.token = None
        self.force_reset = False

    def authorize(self, document, is_api):
        try:
            user_id = document["user"]["id"]

            self.administrator = document["administrator"]
            self.authorized = True
            self.user_id = user_id
            self.groups = document["groups"]
            self.permissions = document["permissions"]
            self.is_api = is_api
            self.force_reset = document["force_reset"]
        except KeyError:
            pass

    def set_session_id(self, session_id):
        self.session_id = session_id


async def auth_response(req, return_to, user_id, remember):
    db = req.app["db"]
    client = req["client"]

    # Create a new authenticated session for the user. This is identical to the process followed for logging in.
    session, token = await virtool.db.sessions.replace_session(db, client.session_id, get_ip(req), user_id, remember)

    req["client"].authorize(session, False)
    req["client"].session_id = session["_id"]

    unquoted_return_to = urllib.parse.unquote(urllib.parse.unquote(return_to))

    resp = web.Response(status=302, headers={"Location": unquoted_return_to})

    resp.set_cookie("session_token", token)

    return resp


async def client_path_error() -> web.Response:
    """
    Returns a response with a rendered error page indicating the the application client files could not be found.

    :return: a response
    """
    html = get_client_file_error_template().render()
    return web.Response(body=html, content_type="text/html")


def get_ip(req: web.Request) -> str:
    """
    A convenience function for getting the client IP address from a :class:`~web.Request` object.

    :param req: the request
    :return: the client's IP address string

    """
    return req.transport.get_extra_info("peername")[0]


def get_client_file_error_template() -> mako.template.Template:
    """
    A convenience function for getting a :class:`~mako.template.Template` for an error page returned when the client
    files cannot be found.

    :return: an error page template

    """
    return mako.template.Template(filename=os.path.join(sys.path[0], "templates", "client_path_error.html"))


def get_login_template() -> mako.template.Template:
    """
    A convenience function for getting a :class:`~mako.template.Template` for the login page.

    :return: a login page template
    """
    return mako.template.Template(filename=os.path.join(sys.path[0], "templates", "login.html"))


def get_reset_template() -> mako.template.Template:
    """
    A convenience function for getting a :class:`~mako.template.Template` for the password reset page.

    :return: a reset page template
    """
    return mako.template.Template(filename=os.path.join(sys.path[0], "templates", "reset.html"))


def get_return_to_from_path(req: web.Request) -> str:
    """
    Get a quoted path from a request path. The returned path can be used as a query parameter in login and reset URLs.

    :param req: the request to derive the quoted path from
    :return: a quoted path

    """
    if req.path == "/login":
        return urllib.parse.quote("/", safe="")

    return urllib.parse.quote(req.path, safe="")


def get_return_to_from_query(req: web.Request) -> str:
    """
    Get a quoted path from a request query string. The returned path can be used as a query parameter in login and reset URLs.

    :param req: the request to derive the quoted path from
    :return: a quoted path
    """
    return_to = req.query.get("return_to", "/")
    return urllib.parse.quote(return_to, safe="")


def decode_authorization(authorization: str) -> tuple:
    """
    Parse and decode an API key from an HTTP authorization header value. Thje

    :param authorization: the authorization header value for a API request
    :return: a tuple containing the user id and API key parsed from the authorization header

    """
    split = authorization.split(" ")

    if len(split) != 2 or split[0] != "Basic":
        raise virtool.errors.AuthError("Malformed authorization header")

    decoded = base64.b64decode(split[1]).decode("utf-8")

    user_id, key = decoded.split(":")

    return user_id, key


@web.middleware
async def middleware(req, handler):
    db = req.app["db"]

    ip = get_ip(req)

    req["client"] = Client(ip)

    authorization = req.headers.get("AUTHORIZATION", None)

    can_use_api_key = req.path[0:4] == "/api" or req.path[0:7] == "/upload"

    # Try API key authorization.
    if req.app["settings"]["enable_api"] and authorization and can_use_api_key:
        try:
            user_id, key = decode_authorization(authorization)
        except virtool.errors.AuthError:
            return bad_request("Malformed Authorization header")

        document = await db.keys.find_one({
            "_id": virtool.users.hash_api_key(key),
            "user.id": user_id
        }, AUTHORIZATION_PROJECTION)

        if not document:
            return bad_request("Invalid Authorization header")

        req["client"].authorize(document, True)

        return await handler(req)

    # Get session information from cookies.
    session_id = req.cookies.get("session_id", None)
    session_token = req.cookies.get("session_token", None)

    session = await virtool.db.sessions.get_session(db, session_id, session_token)

    if session is None:
        session, _ = await virtool.db.sessions.create_session(db, ip)

    req["client"].authorize(session, is_api=False)
    req["client"].session_id = session["_id"]

    resp = await handler(req)

    resp.set_cookie("session_id", req["client"].session_id, httponly=True)

    if not req["client"].user_id:
        resp.del_cookie("session_token")

    return resp


async def index_handler(req: web.Request) -> web.Response:
    """
    A request handler for requests where the `index.html` should be returned.

    This handler deals with redirecting to the login and password reset pages where appropriate.

    :param req: the request to handle
    :return: the response

    """
    if req.app["client_path"] is None:
        try:
            client_path = await virtool.utils.get_client_path()
        except FileNotFoundError:
            return await client_path_error()

        req.app["client_path"] = client_path
        req.app.router.add_static("/static", client_path)

    force_reset = req["client"].force_reset

    if req["client"].user_id and not force_reset:
        path = os.path.join(req.app["client_path"], "index.html")

        html = mako.template.Template(filename=path).render()

        html = html.replace("VERSION", req.app["version"])

        html = html.replace('"DEV"', "true" if req.app["settings"]["dev"] else "false")

        return web.Response(body=html, content_type="text/html")

    path_base = "login"

    if force_reset:
        path_base = "reset"

    return_to = get_return_to_from_path(req)

    return web.Response(status=302, headers={"Location": f"/{path_base}?return_to={return_to}"})


async def login_get_handler(req: web.Request) -> web.Response:
    """
    Handle a request to `GET` the application login page.

    Returns a response with a rendered login page. The rendered template contains a hidden verification key to prevent
    spamming of the login system.

    :param req: the request to handle
    :return: the response

    """
    static_hash = virtool.utils.get_static_hash(req)

    verification_key = await virtool.db.sessions.get_verification_key(req.app["db"], req["client"].session_id)

    error = req.get("login_error", None)

    expired = req.query.get("expired", "false") in ["True", "true"]

    return_to = get_return_to_from_query(req)



    html = virtool.http.auth.get_login_template().render(
        expired=expired,
        verification_key=verification_key,
        hash=static_hash,
        return_to=return_to,
        error=error
    )

    return web.Response(body=html, content_type="text/html")


async def login_post_handler(req: web.Request) -> web.Response:
    """
    Handle a `POST` request to login.

    Validates the verification key and the passed username and password. If the user is flagged for a password reset,
    the session is redirected to the reset password page. If login succeeds the user is redirected to their previous
    location using the `return_to` query parameter.

    :param req: the request to handle
    :return: a response

    """
    db = req.app["db"]

    client = req["client"]

    form_data = await req.post()

    user_id = form_data.get("username", "")
    password = form_data.get("password", "")

    verification_key = form_data.get("verification", None)

    # When this value is set, the session will last for 1 month instead of the 1 hour default.
    remember = form_data.get("remember", "off") == "on"

    # This is the path the user initially navigated to before being redirected to the login page.
    return_to = get_return_to_from_query(req)

    # Check that the hidden verification key matches the one attached to the logging-in session.
    if not await virtool.db.sessions.check_verification_key(db, client.session_id, verification_key):
        return web.Response(status=302, headers={"Location": return_to})

    # Re-render the login page with an error message if the username and/or password are invalid.
    if not await virtool.db.users.validate_credentials(db, user_id, password):
        req["login_error"] = "Invalid username or password"
        return await login_get_handler(req)

    # If the user's password needs to be reset, redirect to the reset page without authorizing the session. A one-time
    # reset code is generated and added to the query string.
    if await virtool.db.utils.get_one_field(db.users, "force_reset", user_id):
        reset_code = await virtool.db.sessions.get_reset_code(db, client.session_id, user_id)
        return web.Response(status=302, headers={"Location": f"/reset?return_to={return_to}&code={reset_code}"})

    return await auth_response(req, return_to, user_id, remember)


async def reset_get_handler(req: web.Request) -> web.Response:
    """
    Handle a request to `GET` the application password reset page.

    Returns a response with a rendered password reset page. When the user successfully logs in in and a reset is
    necessary, a one-time reset code is generated. The user is redirected to a URL containing the reset code. This
    handler validates the reset code query parameter (`code`) and expires it. Invalid reset codes will prevent password
    reset.

    A hidden verification key field is returned in the rendered template. This key can is only sent to the client once
    and can only be used to verify a single post request. If the reset request fails with `4**`, a new verification key
    is created and the template is re-rendered and returned.

    :param req: the request to handle
    :return: a response

    """
    db = req.app["db"]

    session_id = req["client"].session_id

    reset_code = req.query.get("code", None)

    return_to = get_return_to_from_query(req)

    if reset_code is None or not await virtool.db.sessions.check_reset_code(db, session_id, reset_code):
        return web.Response(status=302, headers={"Location": f"/login?return_to={return_to}"})

    static_hash = virtool.utils.get_static_hash(req)

    verification_key = req.get(
        "verification_key",
        await virtool.db.sessions.get_verification_key(db, session_id, mode="reset")
    )

    # Get any errors to render on the reset form. These are recorded from a previous failed reset request.
    errors = await virtool.db.utils.get_one_field(db.sessions, "reset_errors", session_id)

    # Clear the reset errors for the next reset `POST` request.
    await virtool.db.sessions.set_reset_errors(db, session_id)

    html = virtool.http.auth.get_reset_template().render(
        errors=errors,
        hash=static_hash,
        return_to=return_to,
        verification_key = verification_key
    )

    return web.Response(body=html, content_type="text/html")


async def reset_post_handler(req: web.Request) -> web.Response:
    """
    Handles `POST` requests for resetting the password for a session user.

    :param req: the request to handle
    :return: a response

    """
    db = req.app["db"]

    client = req["client"]

    form_data = await req.post()

    password = form_data.get("password", "")
    confirm = form_data.get("confirm", "")
    verification_key = form_data.get("verification", None)
    return_to = get_return_to_from_query(req)

    # Check that the hidden verification key matches the one attached to the logging-in session. Redirect to `return_to`
    # URL if verification fails (this will end up on login page with correct query parameter.
    if not await virtool.db.sessions.check_verification_key(db, client.session_id, verification_key, mode="reset"):
        return web.Response(status=302, headers={"Location": return_to})

    user_id = await virtool.db.utils.get_one_field(db.sessions, "reset_user_id", client.session_id)

    if not user_id:
        return web.Response(status=302, headers={"Location": return_to})

    errors = list()

    # Re-render the reset page with an error message if the new password is invalid.
    if password != confirm:
        errors.append("Passwords do not match")

    minimum_password_length = req.app["settings"]["minimum_password_length"]

    if len(password) < minimum_password_length:
        errors.append(f"Password must contain at least {minimum_password_length} characters")

    if errors:
        reset_code = await virtool.db.sessions.set_reset_errors(db, client.session_id, errors)
        return web.Response(status=302, headers={"Location": f"/reset?return_to={return_to}&code={reset_code}"})

    # Unset all reset page errors.
    await virtool.db.sessions.set_reset_errors(db, client.session_id)

    # Update the user password and disable the `force_reset`.
    await virtool.db.users.edit(db, user_id, force_reset=False, password=password)

    # Authenticate and return a redirect response to the `return_to` path. This is identical to the process used for
    # successful login requests.
    return await auth_response(req, return_to, user_id, False)
