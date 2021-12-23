import virtool.api.json


def test_init(ws):
    """
    Test that :meth:`.Connection.__init__` draws attributes from the passed session and websocket handler.

    """
    assert ws.user_id == "test"
    assert ws.groups == ["admin", "test"]
    assert ws.permissions == ["create_sample"]


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
        dumps=virtool.api.json.dumps,
    )


async def test_close(ws):
    await ws.close()
    ws._ws.close.assert_called()
