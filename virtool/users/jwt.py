import jwt
from arrow import utcnow
from jwt import encode, decode, ExpiredSignatureError, InvalidTokenError

from virtool.utils import timestamp

ACCESS_SECRET = "access_secret"
REFRESH_SECRET = "refresh_secret"
JWT_ALGORITHM = "HS256"


async def create_reset_code_with_jwt():
    pass


async def create_access_token(db, ip: str, user_id: str) -> jwt:
    """
    Create JWT access token encoded using JWT_ALGORITHM and ACCESS_SECRET.

    Access token includes user ID, IP address, expiration time, issued at time, admin status, user groups,
    user permissions, and force reset status.

    Access tokens expire 5 minutes after creation and are replaced in the refresh_tokens() function until refresh token
    expires or is invalidated by a password change.
    """
    payload = {
        "user": {
            "id": user_id
        },
        "ip": ip
    }

    utc = utcnow()
    payload["exp"] = utc.shift(minutes=5).datetime

    payload["iat"] = timestamp()

    user_document = await db.users.find_one(user_id)

    payload["administrator"] = user_document["administrator"]
    payload["groups"] = user_document["groups"]
    payload["permissions"] = user_document["permissions"]
    payload["force_reset"] = user_document["force_reset"]

    encoded_jwt = encode(payload, ACCESS_SECRET, algorithm=JWT_ALGORITHM)

    return encoded_jwt


async def create_refresh_token(db, user_id: str, remember=False):
    """
    Create a refresh token encoded using JWT_ALGORITHM and REFRESH_SECRET and attach it to the user document.

    Hashed user password is added as a salt to REFRESH_SECRET to invalidate refresh tokens if password is changed.

    Refresh tokens expire 30 days after creation if "remember" is True, 60 minutes otherwise.

    When refresh token expires no more access tokens are provided until user repeats login process.
    """
    payload = {
        "user": {
            "id": user_id
        }
    }

    utc = utcnow()
    if remember:
        payload["exp"] = utc.shift(days=30).datetime
    else:
        payload["exp"] = utc.shift(minutes=60).datetime

    payload["iat"] = timestamp()

    user_document = await db.users.find_one(user_id)
    password = user_document["password"]

    return await db.users.find_one_and_update(
        {"_id": user_id},
        {"$set": {"refresh_token": encode(payload, REFRESH_SECRET + str(password), algorithm=JWT_ALGORITHM)}}
    )


async def refresh_tokens(access_token: jwt, db) -> jwt:
    """
    Replaces access token if refresh token hasn't expired and password hasn't been changed.

    If password has changed, tokens that rely on the previous password are invalidated because hashed password is used
    as a salt in the decoding secret for refresh tokens.
    """
    access_token_payload = decode(access_token, ACCESS_SECRET, algorithms=JWT_ALGORITHM, verify_exp=False)
    user_id = access_token_payload["user"]["id"]

    user_document = await db.users.find_one(user_id)
    password = user_document["password"]

    try:
        refresh_token = user_document["refresh_token"]
        decode(refresh_token, REFRESH_SECRET + str(password), algorithms=JWT_ALGORITHM)

        new_access_token = await create_access_token(db, access_token_payload["ip"], user_id)

        return new_access_token
    except (ExpiredSignatureError, InvalidTokenError):
        return None
