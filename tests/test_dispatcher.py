import virtool.api.json
from virtool.dispatcher.dispatcher import Dispatcher
from virtool.dispatcher.listener import RedisDispatcherListener


class TestConnection:

    def test_init(self, test_ws_connection):
        """
        Test that :meth:`.Connection.__init__` draws attributes from the passed session and websocket handler.

        """
        assert test_ws_connection.user_id == "test"
        assert test_ws_connection.groups == ["admin", "test"]
        assert test_ws_connection.permissions == ["create_sample"]

    async def test_send(self, test_ws_connection):
        await test_ws_connection.send({
            "interface": "users",
            "operation": "update",
            "data": {
                "user_id": "john",
                "groups": []
            }
        })

        assert test_ws_connection._ws.send_json.stub.call_args[0] == ({
            'data': {
                'groups': [],
                'user_id': 'john'
            },
            'interface': 'users',
            'operation': 'update'
        }, virtool.api.json.dumps)

    async def test_close(self, test_ws_connection):
        await test_ws_connection.close()

        assert test_ws_connection._ws.close.stub.called


def test_add_connection(mocker, dbi, pg_engine, test_channel):
    dispatcher = Dispatcher(pg_engine, dbi, RedisDispatcherListener(test_channel))

    m = mocker.Mock()

    dispatcher.add_connection(m)

    assert m in dispatcher._connections


def test_remove_connection(mocker, dbi, pg_engine, test_channel):
    dispatcher = Dispatcher(pg_engine, dbi, RedisDispatcherListener(test_channel))

    m = mocker.Mock()

    dispatcher.add_connection(m)

    assert m in dispatcher._connections

    dispatcher.remove_connection(m)

    assert dispatcher._connections == []
