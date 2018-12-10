import os
import sys

import motor.motor_asyncio
import pytest
from aiohttp.test_utils import make_mocked_coro

import virtool.users


@pytest.fixture
def mock_setup():
    return {
        "db_host": "",
        "db_port": 0,
        "db_name": "",
        "db_username": "",
        "db_password": "",
        "db_use_auth": False,
        "db_use_ssl": False,

        "first_user_id": "",
        "first_user_password": "",

        "data_path": "",
        "watch_path": "",

        "errors": {
            "db_auth_error": False,
            "db_connection_error": False,
            "db_host_error": False,
            "db_name_error": False,
            "db_not_empty_error": False,
            "db_port_error": False,
            "data_not_empty_error": False,
            "data_not_found_error": False,
            "data_permission_error": False,
            "watch_not_empty_error": False,
            "watch_not_found_error": False,
            "watch_permission_error": False
        }
    }


async def test_unavailable(spawn_client):
    client = await spawn_client(setup_mode=True)

    resp = await client.get("/api/otus")

    assert resp.status == 503

    assert await resp.json() == {
        "id": "requires_setup",
        "message": "Server is not configured"
    }

    assert resp.headers["Location"] == "/setup"


@pytest.mark.parametrize("url", ["/otus", "/hosts", "/foobar"])
async def test_setup_redirect(url, spawn_client):
    client = await spawn_client(setup_mode=True)

    resp = await client.get(url)

    assert resp.status == 200

    assert "Connect to MongoDB" in await resp.text()


class TestGet:

    @pytest.mark.parametrize("field,value", [
        ("db_host", "192.168.20.170"),
        ("db_port", 98302),
        ("db_name", "foobar")
    ])
    async def test_db(self, field, value, spawn_client, mock_setup):
        client = await spawn_client(setup_mode=True)

        mock_setup[field] = value

        client.app["setup"] = mock_setup

        resp = await client.get("/setup")

        assert resp.status == 200

        text = await resp.text()

        assert '''name="{}" id="{}"'''.format(field, field) in text
        assert '''value='{}'>'''.format(value) in text

    @pytest.mark.parametrize("field,placeholder,value", [
        ("data_path", "data", "foo"),
        ("watch_path", "watch", "bar")
    ])
    async def test_paths(self, field, placeholder, value, spawn_client, mock_setup):
        client = await spawn_client(setup_mode=True)

        mock_setup[field] = value

        client.app["setup"] = mock_setup

        resp = await client.get("/setup")

        assert resp.status == 200

        text = await resp.text()

        for line in text.split("\n"):
            if 'name="{}"'.format(field) in line:
                assert '<input type="text" class="form-control"' in line
                assert 'name="{}" id="{}" placeholder="{}"'.format(field, field, placeholder) in line
                assert "value='{}'".format(value) in line
                break

    async def test_user_id(self, spawn_client, mock_setup):
        client = await spawn_client(setup_mode=True)

        mock_setup["first_user_id"] = "fred"

        client.app["setup"] = mock_setup

        resp = await client.get("/setup")

        assert resp.status == 200

        text = await resp.text()

        assert '''<input type="text" class="form-control" name="user_id" id="user_id" value='fred'>''' in text

    async def test_password(self, spawn_client, mock_setup):
        client = await spawn_client(setup_mode=True)

        mock_setup["first_user_password"] = "hello_world"

        client.app["setup"] = mock_setup

        resp = await client.get("/setup")

        assert resp.status == 200

        text = await resp.text()

        assert '''<input type="password" class="form-control" name="password"''' \
               ''' id="password" value='dummy password'>''' in text


@pytest.mark.parametrize("error", [None, "db_connection_error", "db_not_empty_error"])
async def test_db(error, mocker, request, spawn_client, test_db_name, mock_setup):
    client = await spawn_client(setup_mode=True)

    actual_host = request.config.getoption("db_host")

    update = {
        "db_host": "foobar" if error == "db_connection_error" else actual_host,
        "db_port": 27017,
        "db_name": test_db_name,
        "db_username": "",
        "db_password": ""
    }

    if error == "db_not_empty_error":
        db_client = motor.motor_asyncio.AsyncIOMotorClient(
            io_loop=client.app.loop,
            host=actual_host,
            port=27017
        )

        await db_client[test_db_name].references.insert_one({"_id": "test"})

    resp = await client.post_form("/setup/db", update)

    assert resp.status == 200

    errors = None

    if error == "db_connection_error":
        errors = dict(mock_setup["errors"], db_connection_error=True)

    if error == "db_not_empty_error":
        errors = dict(mock_setup["errors"], db_not_empty_error=True)

    if errors:
        assert client.app["setup"] == {
            **mock_setup,
            "errors": errors
        }
    else:
        assert client.app["setup"] == {
            **mock_setup,
            **update
        }


async def test_user(mocker, spawn_client, mock_setup):
    client = await spawn_client(setup_mode=True)

    update = {
        "user_id": "baz",
        "password": "foobar",
        "password_confirm": "foobar"
    }

    assert client.app["setup"] == mock_setup

    mocker.patch("virtool.users.hash_password", return_value="hashed")

    resp = await client.post_form("/setup/user", update)

    assert resp.status == 200

    mock_setup.update({
        "first_user_id": "baz",
        "first_user_password": "hashed"
    })

    assert client.app["setup"] == mock_setup


@pytest.mark.parametrize("issue", [None, "not_empty", "not_found", "permission"])
@pytest.mark.parametrize("prefix", ["data", "watch"])
async def test(mocker, issue, prefix, tmpdir, spawn_client, mock_setup):
    client = await spawn_client(setup_mode=True)

    path = os.path.join(str(tmpdir), "foobar", "data")

    update = {
        "{}_path".format(prefix): path
    }

    if not issue == "not_found":
        os.makedirs(path)

    if issue == "not_empty":
        with open(os.path.join(path, "test.txt"), "w") as handle:
            handle.write("hello world")

    if issue == "permission":
        mocker.patch("os.mkdir", side_effect=PermissionError)

    resp = await client.post_form("/setup/{}".format(prefix), update)

    assert resp.status == 200

    if issue is not None:
        mock_setup["errors"]["{}_{}_error".format(prefix, issue)] = True

    assert client.app["setup"] == mock_setup


async def test_clear(spawn_client, mock_setup):
    client = await spawn_client(setup_mode=True)

    client.app["setup"] = {
        **mock_setup,
        "db_host": "192.168.20.170",
        "db_port": 9950,
        "db_name": "virtool"
    }

    resp = await client.get("/setup/clear")

    assert resp.status == 200

    assert client.app["setup"] == mock_setup


async def test_save_and_reload(mocker, tmpdir, request, spawn_client, mock_setup, static_time):
    client = await spawn_client(setup_mode=True)

    mocker.patch("virtool.utils.reload", new=make_mocked_coro())

    actual_host = request.config.getoption("db_host", "localhost")

    connection = motor.motor_asyncio.AsyncIOMotorClient(
        io_loop=client.app.loop,
        host=actual_host,
        port=27017,
        serverSelectionTimeoutMS=1500
    )

    await connection.drop_database("foobar")

    m_write_settings_file = mocker.patch("virtool.settings.write_settings_file", make_mocked_coro())

    data = tmpdir.mkdir("data")
    watch = tmpdir.mkdir("watch")

    client.app["setup"] = {
        **mock_setup,
        "db_host": "localhost",
        "db_port": 27017,
        "db_name": "foobar",
        "first_user_id": "fred",
        "first_user_password": "hashed",
        "data_path": str(data),
        "watch_path": str(watch)
    }

    client.app["events"] = {
        "restart": mocker.Mock()
    }

    await client.get("/setup/save")

    assert await connection.foobar.users.find_one() == {
        "_id": "fred",
        "identicon": "d0cfc2e5319b82cdc71a33873e826c93d7ee11363f8ac91c4fa3a2cfcd2286e5",
        "administrator": True,
        "groups": [],
        "invalidate_sessions": False,
        "password": "hashed",
        "last_password_change": static_time.datetime,
        "force_reset": False,
        "primary_group": "",
        "settings": {
            "skip_quick_analyze_dialog": True,
            "quick_analyze_algorithm": "pathoscope_bowtie",
            "show_ids": False,
            "show_versions": False
        },
        "permissions": {p: True for p in virtool.users.PERMISSIONS}
    }

    await connection.drop_database("foobar")

    assert os.path.isdir(str(data))
    assert os.path.isdir(str(watch))

    sub_dirs = [
        "files",
        "references",
        "subtractions",
        "samples",
        "hmm",
        "logs/jobs"
    ]

    for sub in sub_dirs:
        assert os.path.isdir(os.path.join(str(data), sub))

    m_write_settings_file.assert_called_with(os.path.join(sys.path[0], "settings.json"), {
        "data_path": str(data),
        "db_host": "localhost",
        "db_name": "foobar",
        "db_password": "",
        "db_port": 27017,
        "db_use_auth": False ,
        "db_use_ssl": False,
        "db_username": "",
        "watch_path": str(watch)
    })

    assert client.app["events"]["restart"].set.called
