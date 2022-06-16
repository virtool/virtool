import pytest
from aiohttp.test_utils import make_mocked_coro
from aiohttp.web_ws import WebSocketResponse

from virtool.dispatcher.connection import Connection
from virtool.http.client import UserClient
from virtool.users.utils import Permission


@pytest.fixture
def ws(mocker):
    ws = mocker.Mock(spec=WebSocketResponse)

    ws.send_json = make_mocked_coro()
    ws.close = make_mocked_coro()

    client = mocker.Mock(spec=UserClient)

    client.user_id = "test"
    client.groups = ["admin", "test"]
    client.permissions = [Permission.create_sample.value]

    return Connection(ws, client)
