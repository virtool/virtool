import pytest
from aiohttp import web

from virtool.dispatcher.dispatcher import Connection
from virtool.http.auth import UserClient


class MockWS:

    def __init__(self, stub):
        self.stub = stub

    async def send_json(self, data):
        self.stub(data)


@pytest.fixture
def create_test_connection(mocker):
    class TestConnection:

        def __init__(self):
            self.messages = list()
            self.send_stub = mocker.stub()
            self.close_stub = mocker.stub()

        async def send(self, message):
            self.send_stub(message)

        async def close(self):
            self.close_stub()

    return TestConnection


@pytest.fixture
def test_ws_connection(mocker):

    ws = mocker.Mock(spec=web.WebSocketResponse)
    client = mocker.Mock(spec=UserClient)

    # Setup async stub for checking if send_json method was called.
    send_json_stub = mocker.stub(name="send_json")

    async def send_json(data, dumps):
        return send_json_stub(data, dumps)

    send_json.stub = send_json_stub

    ws.send_json = send_json

    # Setup async stub for checking if close method was called.
    close_stub = mocker.stub(name="close")

    async def close():
        return close_stub()

    close.stub = close_stub

    ws.close = close

    client.user_id = "test"
    client.groups = ["admin", "test"]
    client.permissions = ["create_sample"]

    return Connection(ws, client)
