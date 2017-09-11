import os
import sys
import pytest
import motor.motor_asyncio
from cerberus import Validator

import virtool.app_settings


@pytest.fixture
def mock_setup():
    return {
        "db_host": None,
        "db_port": None,
        "db_name": None,

        "first_user_id": None,
        "first_user_password": None,

        "data_path": None,
        "watch_path": None,

        "errors": {
            "db_exists_error": False,
            "db_connection_error": False,
            "password_confirmation_error": False,
            "data_not_empty_error": False,
            "data_not_found_error": False,
            "data_permission_error": False,
            "watch_not_empty_error": False,
            "watch_not_found_error": False,
            "watch_permission_error": False
        }
    }


class TestUnavailable:

    async def test(self, spawn_client):
        client = await spawn_client(setup_mode=True)

        resp = await client.get("/api/viruses")

        assert resp.status == 503

        assert await resp.json() == {
            "id": "requires_setup",
            "message": "Server is not configured"
        }

        assert resp.headers["Location"] == "/setup"


class TestSetupRedirect:

    @pytest.mark.parametrize("url", ["/viruses", "/hosts", "/foobar"])
    async def test(self, url, spawn_client):
        client = await spawn_client(setup_mode=True)

        resp = await client.get(url)

        assert resp.status == 200

        assert "Connect to MongoDB" in await resp.text()


class TestSetupGet:

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

        assert '''<input type="password" class="form-control" name="password_confirm"''' \
               ''' id="password_confirm" value='dummy password'>''' in text


class TestSetupDB:

    async def test(self, spawn_client, mock_setup):
        client = await spawn_client(setup_mode=True)

        update = {
            "db_host": "localhost",
            "db_port": 27017,
            "db_name": "test"
        }

        resp = await client.post_form("/setup/db", update)

        assert resp.status == 200

        expected = dict(mock_setup)

        expected.update(update)

        assert client.app["setup"] == expected

    async def test_connection_error(self, spawn_client, mock_setup):
        client = await spawn_client(setup_mode=True)

        update = {
            "db_host": "foobar",
            "db_port": 27017,
            "db_name": "test"
        }

        resp = await client.post_form("/setup/db", update)

        assert resp.status == 200

        mock_setup["errors"]["db_connection_error"] = True

        assert client.app["setup"] == mock_setup

    async def test_db_exists(self, spawn_client, mock_setup):
        client = await spawn_client(setup_mode=True)

        update = {
            "db_host": "localhost",
            "db_port": 27017,
            "db_name": "foobar"
        }

        connection = motor.motor_asyncio.AsyncIOMotorClient(
            io_loop=client.app.loop,
            host="localhost",
            port=27017,
            serverSelectionTimeoutMS=1500
        )

        await connection.foobar.test.insert_one({"_id": "test"})

        resp = await client.post_form("/setup/db", update)

        await connection.drop_database("foobar")

        assert resp.status == 200

        mock_setup["errors"]["db_exists_error"] = True

        assert client.app["setup"] == mock_setup


class TestSetupUser:

    async def test(self, mocker, spawn_client, mock_setup):
        client = await spawn_client(setup_mode=True)

        update = {
            "user_id": "baz",
            "password": "foobar",
            "password_confirm": "foobar"
        }

        mocker.patch("virtool.user.hash_password", return_value="hashed")

        resp = await client.post_form("/setup/user", update)

        assert resp.status == 200

        mock_setup.update({
            "first_user_id": "baz",
            "first_user_password": "hashed"
        })

        assert client.app["setup"] == mock_setup

    async def test_no_match(self, spawn_client, mock_setup):
        client = await spawn_client(setup_mode=True)

        update = {
            "user_id": "baz",
            "password": "foobar",
            "password_confirm": "hello_world"
        }

        resp = await client.post_form("/setup/user", update)

        assert resp.status == 200

        mock_setup["errors"]["password_confirmation_error"] = True

        assert client.app["setup"] == mock_setup


class TestSetupPaths:

    @pytest.mark.parametrize("issue", [None, "not_empty", "not_found", "permission"])
    @pytest.mark.parametrize("prefix", ["data", "watch"])
    async def test(self, issue, prefix, tmpdir, spawn_client, mock_setup):
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
            os.chmod(path, 000)

        resp = await client.post_form("/setup/{}".format(prefix), update)

        assert resp.status == 200

        if issue is not None:
            mock_setup["errors"]["{}_{}_error".format(prefix, issue)] = True

        assert client.app["setup"] == mock_setup


class TestClear:

    async def test(self, spawn_client, mock_setup):
        client = await spawn_client(setup_mode=True)

        mock_setup.update({
            "db_host": "192.168.20.170",
            "db_port": 9950,
            "db_name": "virtool"
        })

        client.app["setup"] = mock_setup

        resp = await client.get("/setup/clear")

        assert resp.status == 200

        assert client.app["setup"] == {
            "db_host": None,
            "db_port": None,
            "db_name": None,

            "first_user_id": None,
            "first_user_password": None,

            "data_path": None,
            "watch_path": None,

            "errors": {
                "db_exists_error": False,
                "db_connection_error": False,
                "password_confirmation_error": False,
                "data_not_empty_error": False,
                "data_not_found_error": False,
                "data_permission_error": False,
                "watch_not_empty_error": False,
                "watch_not_found_error": False,
                "watch_permission_error": False
            }
        }


class TestSaveAndReload:

    async def test(self, mocker, tmpdir, spawn_client, mock_setup, static_time):
        client = await spawn_client(setup_mode=True)

        m_reload = mocker.patch("virtool.utils.reload")
        m_write_to_file = mocker.patch("virtool.app_settings.write_to_file")

        data = tmpdir.mkdir("data")
        watch = tmpdir.mkdir("watch")

        client.app["setup"] = {
            'db_host': "localhost",
            'db_port': 27017,
            'db_name': "foobar",
            'first_user_id': "fred",
            'first_user_password': "hashed",
            'data_path': str(data),
            'watch_path': str(watch),
            'errors': {
                'data_not_found_error': False,
                'watch_not_empty_error': False,
                'password_confirmation_error': False,
                'db_exists_error': False,
                'data_not_empty_error': False,
                'data_permission_error': False,
                'db_connection_error': False,
                'watch_permission_error': False,
                'watch_not_found_error': False
            }
        }

        await client.get("/setup/save")

        connection = motor.motor_asyncio.AsyncIOMotorClient(
            io_loop=client.app.loop,
            host="localhost",
            port=27017,
            serverSelectionTimeoutMS=1500
        )

        assert await connection.foobar.users.find_one() == {
            "_id": "fred",
            "groups": ["administrator"],
            "invalidate_sessions": False,
            "password": "hashed",
            "last_password_change": static_time,
            "force_reset": False,
            "primary_group": "",
            "settings": {
                "skip_quick_analyze_dialog": True,
                "quick_analyze_algorithm": "pathoscope_bowtie",
                "show_ids": False,
                "show_versions": False
            },
            "permissions": {
                "modify_options": True,
                "modify_hmm": True,
                "remove_virus": True,
                "rebuild_index": True,
                "remove_host": True,
                "modify_virus": True,
                "cancel_job": True,
                "manage_users": True,
                "remove_job": True,
                "create_sample": True,
                "modify_host": True
            }
        }

        await connection.drop_database("foobar")

        assert os.path.isdir(str(data))
        assert os.path.isdir(str(watch))

        subdirs = [
            "files",
            "reference/viruses",
            "reference/subtraction",
            "samples",
            "hmm",
            "logs/jobs"
        ]

        for sub in subdirs:
            assert os.path.isdir(os.path.join(str(data), sub))

        assert m_reload.called

        v = Validator(virtool.app_settings.SCHEMA)

        v({
            'db_host': "localhost",
            'db_port': 27017,
            'db_name': "foobar",
            'data_path': str(data),
            'watch_path': str(watch)
        })

        assert m_write_to_file.call_args[0] == (v.document, os.path.join(sys.path[0], "settings.json"))
