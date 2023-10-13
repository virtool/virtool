import pytest

from virtool.mongo.core import Mongo
from virtool.references.db import get_manifest, check_right, fetch_and_update_release
from virtool.startup import startup_http_client_session


@pytest.fixture
async def fake_app():
    version = "v1.2.3"

    app = {"version": version}

    yield app

    # Close real session created in `test_startup_executors()`.
    try:
        await app["client"].close()
    except TypeError:
        pass


@pytest.mark.parametrize("is_administrator", [True, False])
@pytest.mark.parametrize("membership", [None, "group", "user"])
@pytest.mark.parametrize(
    "right,expect", [("read", True), ("modify_otu", True), ("modify", False)]
)
async def test_check_right(
    is_administrator: bool,
    expect: bool,
    membership: str | None,
    right: str,
    mock_req,
    mocker,
    mongo: Mongo,
):
    mock_req.app = {"db": mongo}

    mock_req["client"] = mocker.Mock()
    mock_req["client"].administrator = is_administrator
    mock_req["client"].user_id = "bar"
    mock_req["client"].groups = ["foo"]

    await mongo.references.insert_one(
        {
            "_id": "baz",
            "groups": [
                {
                    "id": "foo" if membership == "group" else "none",
                    "read": True,
                    "modify": False,
                    "modify_otu": True,
                }
            ],
            "users": [
                {
                    "id": "bar" if membership == "user" else "none",
                    "read": True,
                    "modify": False,
                    "modify_otu": True,
                }
            ],
        }
    )

    result = await check_right(mock_req, "baz", right)

    if is_administrator:
        assert result is True
    elif membership is None:
        assert result is False
    else:
        assert result is expect


async def test_create_manifest(mongo: Mongo, test_otu: dict):
    await mongo.otus.insert_many(
        [
            test_otu,
            {**test_otu, "_id": "foo", "version": 5},
            {**test_otu, "_id": "baz", "version": 3, "reference": {"id": "123"}},
            {**test_otu, "_id": "bar", "version": 11},
        ],
        session=None,
    )

    assert await get_manifest(mongo, "hxn167") == {
        "6116cba1": 0,
        "foo": 5,
        "bar": 11,
    }


async def test_fetch_and_update_release(mongo: Mongo, fake_app, snapshot, static_time):
    await startup_http_client_session(fake_app)

    await mongo.references.insert_one(
        {
            "_id": "fake_ref_id",
            "installed": {"name": "1.0.0-fake-install"},
            "release": {"name": "1.0.0-fake-release"},
            "remotes_from": {"slug": "virtool/ref-plant-viruses"},
        }
    )

    assert (
        await fetch_and_update_release(mongo, fake_app["client"], "fake_ref_id", False)
        == snapshot
    )
