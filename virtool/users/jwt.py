import secrets

from jwt import encode
from arrow import utcnow

from virtool.utils import timestamp


async def create_reset_code_with_jwt():
    return secrets.token_hex(32)


async def create_access_token(db, ip, user_id, remember):
    """
    HS256 - HMAC using SHA-256 hash algorithm (default) - this is what we used before

    TODO: Use RS56
    """
    payload = await create_access_token_payload(db, ip, user_id, remember)
    secret = await fetch_access_token_secret()

    encoded_jwt = encode(payload, secret, algorithm="HS256")
    return encoded_jwt


async def create_access_token_payload(db, ip, user_id, remember):
    payload = {
        "user": {
            "id": user_id
        },
        "ip": ip
    }

    utc = utcnow()
    if remember:
        payload["exp"] = utc.shift(days=30).datetime
    else:
        payload["exp"] = utc.shift(minutes=60).datetime

    payload["iat"] = timestamp()

    user_document = await db.users.find_one(user_id)

    payload["administrator"] = user_document["administrator"]
    payload["groups"] = user_document["groups"]
    payload["permissions"] = user_document["permissions"]
    payload["force_reset"] = user_document["force_reset"]

    return payload


async def fetch_access_token_secret():
    """
    fetch secret somehow from safely stored location

    TODO: look into key-tool/keychain managers. See how virtool currently manages secrets.
    """
    return "access_secret"


async def create_refresh_token():
    return encode({"refresh": "info"}, fetch_refresh_token_secret(), algorithm="HS256")


async def fetch_refresh_token_secret():
    """
    fetch secret somehow from safely stored location
    """
    return "refresh_secret"
