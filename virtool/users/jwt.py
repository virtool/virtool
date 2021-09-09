from secrets import token_hex

from arrow import utcnow
from jwt import encode, decode, ExpiredSignatureError

from virtool.utils import timestamp

ACCESS_SECRET = "access_secret"
REFRESH_SECRET = "refresh_secret"
ENCODING_ALGORITHM = "HS256"


async def create_reset_code_with_jwt():
    return token_hex(32)


async def create_access_token(db, ip, user_id):
    """
    Create JWT access token encoded using ENCODING ALGORITHM and ACCESS_SECRET.

    Access token includes user ID, IP address, expiration time, issued at time, admin status, user groups,
    user permissions, and force reset status.

    Access tokens expire 5 minutes after creation and are replaced in the refresh_tokens() function until refresh token
    expires or is invalidated.
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

    secret = ACCESS_SECRET

    encoded_jwt = encode(payload, secret, algorithm=ENCODING_ALGORITHM)
    return encoded_jwt


async def create_refresh_token(db, user_id, remember=None, exp=None):
    """
    Create a refresh token encoded using ENCODING_ALGORITHM and REFRESH_SECRET.

    Hashed user password is added as a salt to REFRESH_SECRET to invalidate refresh tokens if password is changed.

    Refresh tokens expire 30 days after creation if "remember" is True, 60 minutes otherwise.

    When refresh token expires user is logged out.
    """
    payload = {
        "user": {
            "id": user_id
        }
    }

    utc = utcnow()
    if exp:
        payload["exp"] = exp
    elif remember:
        payload["exp"] = utc.shift(days=30).datetime
    else:
        payload["exp"] = utc.shift(minutes=60).datetime

    payload["iat"] = timestamp()

    user_document = await db.users.find_one(user_id)
    password = user_document["password"]

    return encode(payload, REFRESH_SECRET + password, algorithm=ENCODING_ALGORITHM)


async def refresh_tokens(access_token, refresh_token, db):
    """
    Replaces access token and refresh token as long as refresh token hasn't expired.
    """
    access_token_payload = decode(access_token, ACCESS_SECRET, ENCODING_ALGORITHM, verify_exp=False)
    user_id = access_token_payload["user"]["id"]

    new_access_token = create_access_token(db, access_token_payload["ip"], user_id)

    user_data = await db.users.find_one(user_id)
    password = user_data["password"]

    try:
        decoded_refresh_token = decode(refresh_token, REFRESH_SECRET + password, algorithms=ENCODING_ALGORITHM)
        new_refresh_token = create_refresh_token(db, user_id, exp=decoded_refresh_token["exp"])

        return new_access_token, new_refresh_token
    except ExpiredSignatureError:
        # log out user
        pass
