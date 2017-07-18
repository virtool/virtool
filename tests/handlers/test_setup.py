import pytest


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

    async def test(self, do_get):
        resp = await do_get("/api/viruses")

        assert resp.status == 503

        assert await resp.json() == {
            "id": "requires_setup",
            "message": "Server is not configured"
        }

        assert resp.headers["Location"] == "/setup"


class TestSetupRedirect:

    @pytest.mark.parametrize("url", ["/viruses", "/hosts", "/foobar"])
    async def test(self, url, do_get):
        resp = await do_get(url)

        assert resp.status == 200

        assert "Connect to MongoDB" in await resp.text()


class TestSetupGet:

    @pytest.mark.parametrize("field,value", [
        ("db_host", "192.168.20.170"),
        ("db_port", 98302),
        ("db_name", "foobar")
    ])
    async def test_db(self, field, value, do_get, mock_setup):
        await do_get.init_client()

        mock_setup[field] = value

        do_get.server.app["setup"] = mock_setup

        resp = await do_get("/setup")

        assert resp.status == 200

        text = await resp.text()

        assert '''name="{}" id="{}"'''.format(field, field) in text
        assert '''value='{}'>'''.format(value) in text

    @pytest.mark.parametrize("field,placeholder,value", [
        ("data_path", "data", "foo"),
        ("watch_path", "watch", "bar")
    ])
    async def test_paths(self, field, placeholder, value, do_get, mock_setup):
        await do_get.init_client()

        mock_setup[field] = value

        do_get.server.app["setup"] = mock_setup

        resp = await do_get("/setup")

        assert resp.status == 200

        text = await resp.text()

        for line in text.split("\n"):
            if 'name="{}"'.format(field) in line:
                assert '<input type="text" class="form-control"' in line
                assert 'name="{}" id="{}" placeholder="{}"'.format(field, field, placeholder) in line
                assert "value='{}'".format(value) in line
                break

    async def test_user_id(self, do_get, mock_setup):
        await do_get.init_client()

        mock_setup["first_user_id"] = "fred"

        do_get.server.app["setup"] = mock_setup

        resp = await do_get("/setup")

        assert resp.status == 200

        text = await resp.text()

        assert '''<input type="text" class="form-control" name="user_id" id="user_id" value='fred'>''' in text

    async def test_password(self, do_get, mock_setup):
        await do_get.init_client()

        mock_setup["first_user_password"] = "hello_world"

        do_get.server.app["setup"] = mock_setup

        resp = await do_get("/setup")

        assert resp.status == 200

        text = await resp.text()

        assert '''<input type="password" class="form-control" name="password"''' \
               ''' id="password" value='dummy password'>''' in text

        assert '''<input type="password" class="form-control" name="password_confirm"''' \
               ''' id="password_confirm" value='dummy password'>''' in text
