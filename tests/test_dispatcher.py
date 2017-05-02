import pytest

import virtool.handlers.utils
from virtool.app_dispatcher import Dispatcher, Connection


class TestConnection:

    def test_init(self, test_ws_connection):
        """
        Test that :meth:`.Connection.__init__` draws attributes from the passed session and websocket handler.
         
        """
        assert test_ws_connection.user_id == "test"
        assert test_ws_connection.groups == ["admin", "test"]
        assert test_ws_connection.permissions == ["modify_virus"]

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
        }, virtool.handlers.utils.dumps)

    async def test_close(self, test_ws_connection):
        await test_ws_connection.close()

        assert test_ws_connection._ws.close.stub.called



class TestConnections:

    def test_add_connection(self, mocker):

        dispatcher = Dispatcher()

        m = mocker.Mock()

        dispatcher.add_connection(m)

        assert m in dispatcher.connections

    def test_remove_connection(self, mocker):

        dispatcher = Dispatcher()

        m = mocker.Mock()

        dispatcher.add_connection(m)

        assert m in dispatcher.connections

        dispatcher.remove_connection(m)

        assert dispatcher.connections == []


class TestDispatch:

    def test_dispatch_authorized(self, mocker):
        """
        Test if an authorized connection can have a message dispatched through it using its ``send`` method.

        """
        dispatcher = Dispatcher()

        m = mocker.Mock(spec=Connection)

        m.user_id = "test"

        dispatcher.add_connection(m)

        dispatcher.dispatch("test", "test", {"test": True})

        m.send.assert_called_with({
            "interface": "test",
            "operation": "test",
            "data": {
                "test": True
            }
        })

    def test_dispatch_unauthorized(self, mocker):
        """
        Test an unauthorized connections does not have its ``send`` method called during a dispatch.

        """
        dispatcher = Dispatcher()

        m = mocker.Mock(spec=Connection)

        m.user_id = None

        dispatcher.add_connection(m)

        dispatcher.dispatch("test", "test", {"test": True})

        m.send.assert_not_called()

    def test_dispatch_either(self, mocker):
        """
        Test the only the authorized connection has its ``send`` method called when an one authorized and one
        unauthorized connection are managed by the dispatcher.

        """
        dispatcher = Dispatcher()

        m_authorized = mocker.Mock(spec=Connection)
        m_authorized.user_id = "test"

        m_unauthorized = mocker.Mock(spec=Connection)
        m_unauthorized.user_id = None

        dispatcher.add_connection(m_authorized)
        dispatcher.add_connection(m_unauthorized)

        dispatcher.dispatch("test", "test", {"test": True})

        m_authorized.send.assert_called_with({
            "interface": "test",
            "operation": "test",
            "data": {
                "test": True
            }
        })

        m_unauthorized.send.assert_not_called()

    def test_dispatch_specific(self, mocker):
        """
        Test that only the connection passed in the keyword argument ``connections`` has its ``send`` method called when
        a dispatch occurs.

        """
        dispatcher = Dispatcher()

        m_1 = mocker.Mock(spec=Connection)
        m_1.user_id = "bob"

        m_2 = mocker.Mock(spec=Connection)
        m_2.user_id = "fred"

        m_3 = mocker.Mock(spec=Connection)
        m_3.user_id = "test"

        for m in (m_1, m_2, m_3):
            dispatcher.add_connection(m)

        dispatcher.dispatch("test", "test", {"test": True}, connections=[m_2])

        m_1.send.assert_not_called()

        m_2.send.assert_called_with({
            "interface": "test",
            "operation": "test",
            "data": {
                "test": True
            }
        })

        m_3.send.assert_not_called()

    def test_callable_filter(self, mocker):
        """
        Test that the ``conn_filter`` keyword argument properly filters connections and dispatches to them.

        """
        dispatcher = Dispatcher()

        m_1 = mocker.Mock(spec=Connection)
        m_1.user_id = "bob"

        m_2 = mocker.Mock(spec=Connection)
        m_2.user_id = "fred"

        dispatcher.add_connection(m_1)
        dispatcher.add_connection(m_2)

        dispatcher.dispatch("test", "test", {"test": True}, conn_filter=lambda conn: conn.user_id == "bob")

        m_1.send.assert_called_with({
            "interface": "test",
            "operation": "test",
            "data": {
                "test": True
            }
        })

        m_2.send.assert_not_called()

    def test_not_callable_filter(self):
        """
        Test that that passing a non-callable ``conn_filter`` keyword argument raises a specific ``TypeError``.

        """
        with pytest.raises(TypeError) as err:
            Dispatcher().dispatch("test", "test", {"test": True}, conn_filter=True)

        assert "conn_filter must be callable" in str(err.value)

    def test_callable_modifier(self, mocker):
        """
        Test that the ``conn_modifier`` keyword argument properly modifies connection objects.

        """
        dispatcher = Dispatcher()

        m_1 = mocker.Mock(spec=Connection)
        m_1.user_id = "bob"

        m_2 = mocker.Mock(spec=Connection)
        m_2.user_id = "fred"

        dispatcher.add_connection(m_1)
        dispatcher.add_connection(m_2)

        def apply_male(conn):
            conn.groups = ["men"]

        dispatcher.dispatch("test", "test", {"test": True}, conn_modifier=apply_male)

        assert m_1.groups == ["men"]
        assert m_2.groups == ["men"]

    def test_not_callable_modifier(self):
        """
        Test that an non-callable ``conn_modifier`` raises a specific ``TypeError``.

        """
        with pytest.raises(TypeError) as err:
            Dispatcher().dispatch("test", "test", {"test": True}, conn_modifier="abc")

        assert "conn_modifier must be callable" in str(err.value)

    def test_modifier_filter(self, mocker):
        """
        Test that the ``conn_modifier`` keyword argument only modifies connection objects that pass ``conn_filter``.

        """
        dispatcher = Dispatcher()

        m_1 = mocker.Mock(spec=Connection)
        m_1.user_id = "bob"
        m_1.groups = None

        m_2 = mocker.Mock(spec=Connection)
        m_2.user_id = "fred"
        m_2.groups = None

        dispatcher.add_connection(m_1)
        dispatcher.add_connection(m_2)

        def apply_male(conn):
            conn.groups = ["men"]

        dispatcher.dispatch(
            "test", "test", {"test": True},
            conn_filter=lambda conn: conn.user_id == "bob",
            conn_modifier=apply_male
        )

        assert m_1.groups == ["men"]
        assert m_2.groups is None

    def test_writer(self, mocker):
        """
        Test that a writer can properly modify and write a message to the passed connection.

        """
        def writer(connection, message):
            if connection.user_id == "bob":
                message["data"]["test"] = False

            connection.send(message)

        dispatcher = Dispatcher()

        m_1 = mocker.Mock(spec=Connection)
        m_1.user_id = "bob"

        m_2 = mocker.Mock(spec=Connection)
        m_2.user_id = "fred"

        dispatcher.add_connection(m_1)
        dispatcher.add_connection(m_2)

        dispatcher.dispatch("test", "test", {"test": True}, writer=writer)

        m_1.send.assert_called_with({
            "interface": "test",
            "operation": "test",
            "data": {
                "test": False
            }
        })

        m_2.send.assert_called_with({
            "interface": "test",
            "operation": "test",
            "data": {
                "test": True
            }
        })

    def test_writer_not_callable(self):
        """
        Test that a writer can properly modify and write a message to the passed connection.

        """
        with pytest.raises(TypeError) as err:
            Dispatcher().dispatch("test", "test", {"test": True}, writer="writer")

        assert "writer must be callable" in str(err)
