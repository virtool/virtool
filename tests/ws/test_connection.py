from virtool.api.custom_json import dump_string
from virtool.users.utils import Permission


def test_init(ws):
    """
    Test that Connection object draws attributes from the passed session and websocket
    handler.

    """
    assert ws.user_id == "test"
    assert ws.groups == ["admin", "test"]
    assert ws.permissions == [Permission.create_sample.value]


async def test_send(ws):
    """
    Test that calling the send method calls the send_json method on the underlying
    WebSocket response.
    """
    await ws.send(
        {
            "interface": "users",
            "operation": "update",
            "data": {"groups": [], "user_id": "john"},
        }
    )

    ws._ws.send_json.assert_called_with(
        {
            "interface": "users",
            "operation": "update",
            "data": {"groups": [], "user_id": "john"},
        },
        dumps=dump_string,
    )


async def test_close(ws):
    """
    Test that closing the connection calls the close method on the underlying WebSocket
    response.
    """
    await ws.close(1000)
    ws._ws.close.assert_called()
