from asyncio import to_thread
import json
from dataclasses import dataclass, asdict

import jwt
from aiohttp.web import Application

from virtool.config import get_config_from_app


@dataclass
class JWKArgs:
    kty: str
    kid: str
    use: str
    n: str
    e: str


async def validate_token(app: Application, token) -> dict:
    """
    Validate token and return claims using JWK_ARGS environment variable.

    :param token: JWT token to validate
    :param app: the application object
    :return: JWT claims
    """

    jwk_args = app["b2c"].jwk_args or await update_jwk_args(app, token)

    return jwt.decode(
        token,
        asdict(jwk_args),
        algorithms=["RS256"],
        audience=get_config_from_app(app).b2c_client_id,
    )


async def update_jwk_args(app: Application, token: jwt) -> JWKArgs:
    """
    Update jwk_args and store in environment variable

    :param token: JWT token to validate and decode
    :param app: the app object
    :return: jwk_args
    """
    header = await to_thread(jwt.get_unverified_header, token)
    authority = app["b2c"].authority
    resp = await app["client"].get(
        f"{authority}/discovery/v2.0/keys", allow_redirects=True
    )
    jwks = json.loads(await resp.text())

    jwk = await get_matching_jwk(jwks, header["kid"])

    jwk_args = JWKArgs(
        kty=jwk["kty"], kid=jwk["kid"], use=jwk["use"], n=jwk["n"], e=jwk["e"]
    )

    app["b2c"].jwk_args = jwk_args

    return jwk_args


async def get_matching_jwk(jwks: dict, kid: str) -> dict:
    """
    Iterate through JSON web key set and return first key with
    matching KID from the token header.

    :param jwks: JSON web key set
    :param kid: Json web key ID from token header

    :return: JWK with matching KID
    """
    for jwk in jwks["keys"]:
        if jwk["kid"] == kid:
            return jwk
