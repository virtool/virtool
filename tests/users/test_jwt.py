import pytest
from jwt import decode

from virtool.users.jwt import create_access_token, ACCESS_SECRET, JWT_ALGORITHM, create_refresh_token, REFRESH_SECRET, \
    refresh_tokens
from virtool.users.utils import hash_password


@pytest.fixture()
def iat_time(mocker):
    mocker.patch("virtool.utils.timestamp", return_value=0)


async def test_create_access_token(dbi, static_time, iat_time):
    """
    Test that access token is created and decoded as expected
    """
    db = dbi

    await db.users.insert_one({
        "_id": "foobar",
        "administrator": False,
        "groups": [],
        "permissions": [],
        "force_reset": False
    })

    encoded = await create_access_token(db, "ip", "foobar")

    document = decode(encoded, ACCESS_SECRET, algorithms=JWT_ALGORITHM)

    assert isinstance(document.pop("exp"), int)
    assert document == {
        "user": {
            "id": "foobar",
        },
        "ip": "ip",
        "administrator": False,
        "groups": [],
        "permissions": [],
        "force_reset": False,
        "iat": 0,
    }


async def test_login_with_jwt(spawn_client, mocker, iat_time):
    """
    Test that access token is created and attached to AUTHORIZATION header as expected during login.
    """
    client = await spawn_client()
    mocker.patch("virtool.http.auth.get_ip", return_value="ip")

    await client.db.users.insert_one({
        "_id": "username",
        "administrator": False,
        "groups": [],
        "permissions": [],
        "force_reset": False,
        "password": hash_password("p@ssw0rd123")
    })

    resp = await client.post("/api/account/login_with_jwt", {
        "username": "username",
        "password": "p@ssw0rd123",
    })

    assert resp.status == 201
    encoded = resp.cookies.get("access_token").value
    decoded = decode(encoded, ACCESS_SECRET, algorithms=JWT_ALGORITHM)

    assert isinstance(decoded.pop("exp"), int)
    assert decoded == {
        "administrator": False,
        "force_reset": False,
        "groups": [],
        "permissions": [],
        "user": {'id': 'username'},
        "iat": 0,
        "ip": "ip"
    }


async def test_create_refresh_token(dbi, iat_time):
    """
    Test that refresh token is created and attached to user document as expected
    """
    db = dbi

    await db.users.insert_one({
        "_id": "foobar",
        "administrator": False,
        "groups": [],
        "permissions": [],
        "force_reset": False,
        "password": "p@ssw0rd123"
    })

    await create_refresh_token(db, "foobar")

    user_document = await db.users.find_one("foobar")
    refresh_token = user_document["refresh_token"]

    decoded = decode(refresh_token, REFRESH_SECRET + "p@ssw0rd123", algorithms=JWT_ALGORITHM)

    assert isinstance(decoded.pop("exp"), int)
    assert decoded == {
        "user": {
            "id": "foobar"
        },
        "iat": 0,
    }


@pytest.mark.parametrize("password_change", [True, False])
async def test_refresh_tokens(dbi, password_change, iat_time):
    """
    Test that refresh_tokens returns a valid access token if password hasn't been changed
    """
    db = dbi

    await db.users.insert_one({
        "_id": "foobar",
        "administrator": False,
        "groups": [],
        "permissions": [],
        "force_reset": False,
        "password": "p@ssw0rd123"
    })

    encoded = await create_access_token(db, "ip", "foobar")

    await create_refresh_token(db, "foobar")

    if password_change:
        await db.users.find_one_and_update(
            {"_id": "foobar"},
            {"$set": {"password": "new_password"}}
        )

    new_token = await refresh_tokens(encoded, db)

    if password_change:
        assert new_token is None
    else:
        decoded = decode(encoded, ACCESS_SECRET, algorithms=JWT_ALGORITHM)

        assert isinstance(decoded.pop("exp"), int)
        assert decoded == {
            "administrator": False,
            "force_reset": False,
            "groups": [],
            "permissions": [],
            "user": {"id": "foobar"},
            "iat": 0,
            "ip": "ip"
        }
