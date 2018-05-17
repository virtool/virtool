import pytest
from aiohttp.test_utils import make_mocked_coro


async def test_create(spawn_client, test_random_alphanumeric, static_time):
    client = await spawn_client(authorize=True, permissions=["create_ref"])

    default_source_type = [
        "strain",
        "isolate"
    ]

    client.app["settings"] = {
        "default_source_types": default_source_type
    }

    data = {
        "name": "Test Viruses",
        "description": "A bunch of viruses used for testing",
        "data_type": "genome",
        "organism": "virus",
        "public": True
    }

    resp = await client.post("/api/refs", data)

    assert resp.status == 201

    assert resp.headers["Location"] == "/api/refs/" + test_random_alphanumeric.history[0]

    assert await resp.json() == dict(
        data,
        id=test_random_alphanumeric.history[0],
        created_at="2015-10-06T20:00:00Z",
        user={
            "id": "test"
        },
        users=[{
            "build": True,
            "id": "test",
            "modify": True,
            "modify_otu": True,
            "remove": True
        }],
        groups=[],
        contributors=[],
        internal_control=None,
        restrict_source_types=False,
        source_types=default_source_type,
        latest_build=None
    )


@pytest.mark.parametrize("error", [None, 404, 409])
@pytest.mark.parametrize("field", ["group", "user"])
async def test_add_group_or_user(error, field, mocker, spawn_client, resp_is):
    client = await spawn_client(authorize=True, permissions=["create_ref"])

    expected = {"id": "test"}

    if error == 404:
        expected = None

    m_add_group_or_user = mocker.patch("virtool.db.references.add_group_or_user", make_mocked_coro(expected))

    url = "/api/refs/foobar/{}s".format(field)

    resp = await client.post(url, {
        field + "_id": "baz",
        "modify": True
    })

    if exists:
        assert resp.status == 201

        assert await resp.json() == expected

        m_add_group_or_user.assert_called_with(client.db, "foobar", field + "s", {
            "build": False,
            "modify": True,
            "modify_otu": False,
            "remove": False,
            field + "_id": "baz"
        })

    else:
        assert await resp_is.not_found(resp)
