import virtool.api.custom_json
from virtool.api.custom_json import dumps
from virtool.users.utils import Permission


def test_init(ws):
    """
    Test that :meth:`.Connection.__init__` draws attributes from the passed session and websocket handler.

    """
    assert ws.user_id == "test"
    assert ws.groups == ["admin", "test"]
    assert ws.permissions == [Permission.create_sample.value]


async def test_send(ws):
    """ """
    message = {
        "interface": "users",
        "operation": "update",
        "data": {"groups": [], "user_id": "john"},
    }

    await ws.send(message)

    ws._ws.send_json.assert_called_with(
        {
            "interface": "users",
            "operation": "update",
            "data": {"groups": [], "user_id": "john"},
        },
        dumps=dumps,
    )


async def test_close(ws):
    await ws.close(1000)
    ws._ws.close.assert_called()
