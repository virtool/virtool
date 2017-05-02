import pytest

from aiohttp import web

from virtool.app_dispatcher import Connection
from virtool.user_sessions import Session


class MockWS:

    def __init__(self, stub):
        self.stub = stub

    async def send_json(self, data):
        self.stub(data)


@pytest.fixture
def test_ws_connection(mocker):

    ws = mocker.Mock(spec=web.WebSocketResponse)
    session = mocker.Mock(spec=Session)

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

    session.user_id = "test"
    session.groups = ["admin", "test"]
    session.permissions = ["modify_virus"]

    return Connection(ws, session)
