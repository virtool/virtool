import json
import pytest

from virtool.dispatcher import Dispatcher, gen_log_prefix


@pytest.fixture(scope="function")
def empty_dispatcher(called_tester):
    return Dispatcher(called_tester())


@pytest.fixture(scope="function")
def dispatcher(empty_dispatcher, mock_interface, mock_settings):
    empty_dispatcher.add_interface("test", mock_interface, mock_settings)
    return empty_dispatcher


@pytest.fixture(params=["open", "on_message", "on_close", "write_message"])
def bad_connection(request, mock_connection):
    def create(settings):
        socket = mock_connection(settings, auto=False)
        setattr(socket, request.param, None)

        return socket

    return create


@pytest.fixture(scope="function")
def fake_message():
    return {
        "operation": "test",
        "interface": "test",
        "data": dict(message="This is a test")
    }


class TestInit:

    def test_ping(self, dispatcher):

        callback = dispatcher.add_periodic_callback

        assert callback.was_called
        assert callback.with_args[0].__name__ == "ping"
        assert callback.with_args[1] == 10000


class TestConnections:

    def test_add_connection(self, dispatcher, mock_connection):

        conn = mock_connection(dispatcher, auto=False)

        assert dispatcher.connections == []

        conn.open()

        assert dispatcher.connections == [conn]

    def test_add_bad_connection(self, dispatcher, bad_connection):

        conn = bad_connection(dispatcher)

        for method_name in ["open", "on_message", "on_close", "write_message"]:
            if getattr(conn, method_name) is None:
                with pytest.raises(AttributeError):
                    dispatcher.add_connection(conn)

    def test_remove_connection(self, dispatcher, mock_connection):

        conn = mock_connection(dispatcher)

        assert dispatcher.connections == [conn]

        dispatcher.remove_connection(conn)

        assert dispatcher.connections == []

    def test_close_connection(self, dispatcher, mock_connection):

        conn = mock_connection(dispatcher)

        assert dispatcher.connections == [conn]

        conn.close()

        assert dispatcher.connections == []


class TestDispatch:

    def test_dispatch_authorized(self, dispatcher, mock_connection, fake_message):
        """
        Test the both of two AUTHORIZED connections can have messages dispatched through them using their
        ``write_message`` methods.

        """
        conn1 = mock_connection(dispatcher)
        conn2 = mock_connection(dispatcher)

        dispatcher.dispatch(fake_message)

        assert conn1.messages[0] == fake_message
        assert conn2.messages[0] == fake_message

    def test_dispatch_unauthorized(self, dispatcher, mock_connection, fake_message):
        """
        Test the neither of two unauthorized connections have their ``write_message`` methods called during a dispatch.

        """
        conn1 = mock_connection(dispatcher, authorized=False)
        conn2 = mock_connection(dispatcher, authorized=False)

        dispatcher.dispatch(fake_message)

        assert conn1.messages == []
        assert conn2.messages == []

    def test_dispatch_either(self, dispatcher, mock_connection, fake_message):
        """
        Test the only the authorized connection has its ``write_message`` method called when an one authorized and one
        unauthorized connection are managed by the dispatcher.

        """
        conn1 = mock_connection(dispatcher, authorized=False)
        conn2 = mock_connection(dispatcher, authorized=True)

        dispatcher.dispatch(fake_message)

        assert conn1.messages == []
        assert conn2.messages == [fake_message]

    def test_dispatch_specific(self, dispatcher, mock_connection, fake_message):
        """
        Test that only the connection passed in the keyword argument ``connections`` has its ``write_message``
        method called when a dispatch occurs.

        """
        conn1 = mock_connection(dispatcher)
        conn2 = mock_connection(dispatcher)

        dispatcher.dispatch(fake_message, connections=[conn2])

        assert conn1.messages == []
        assert conn2.messages[0] == fake_message

    def test_callable_filter(self, dispatcher, mock_connection, fake_message):
        """
        Test that the conn_filter keyword argument properly filters connections and dispatches to them.

        """
        conn1 = mock_connection(dispatcher, username="winston")
        conn2 = mock_connection(dispatcher, username="wallace")

        dispatcher.dispatch(fake_message, conn_filter=lambda conn: conn.user["_id"] == "winston")

        assert conn1.messages[0] == fake_message
        assert len(conn2.messages) == 0

    def test_not_callable_filter(self, dispatcher, mock_connection, fake_message):
        """
        Test that that passing a non-callable conn_filter keyword argument raises a specific TypeError.

        """
        with pytest.raises(TypeError) as err:
            dispatcher.dispatch(fake_message, conn_filter="abc")

        assert "conn_filter must be callable" in str(err.value)

    def test_callable_modifier(self, dispatcher, mock_connection, fake_message):
        """
        Test that the conn_modifier keyword argument properly modifies connection objects.

        """
        conn1 = mock_connection(dispatcher, username="winston")
        conn2 = mock_connection(dispatcher, username="wallace")

        def apply_animal(conn):
            conn.user["animal"] = True

        dispatcher.dispatch(fake_message, conn_modifier=apply_animal)

        assert conn1.user["animal"]
        assert conn2.user["animal"]

        assert len(conn1.messages) == 1
        assert len(conn2.messages) == 1

    def test_not_callable_modifier(self, dispatcher, mock_connection, fake_message):
        """
        Test that an non-callable conn_modifier raises a specific TypeError.

        """
        with pytest.raises(TypeError) as err:
            dispatcher.dispatch(fake_message, conn_modifier="abc")

        assert "conn_modifier must be callable" in str(err.value)

    def test_modifier_filter(self, dispatcher, mock_connection, fake_message):
        """
        Test that the conn_modifier keyword argument only modifies connection objects that pass conn_filter.

        """
        conn1 = mock_connection(dispatcher, username="winston")
        conn2 = mock_connection(dispatcher, username="wallace")

        def apply_animal(conn):
            conn.user["animal"] = "monkey"

        dispatcher.dispatch(fake_message, conn_filter=lambda conn: conn.user["_id"] == "wallace", conn_modifier=apply_animal)

        # Only conn2 (wallace) should write messages.
        assert len(conn1.messages) == 0
        assert len(conn2.messages) == 1

        # conn1 (winston) should not have 'animal' key.
        assert "animal" not in conn1.user

        # conn2 (wallace) should have 'animal' key set to 'monkey'.
        assert conn2.user["animal"] == "monkey"

    def test_writer(self, dispatcher, mock_connection, fake_message):
        """
        Test that a writer can properly modify and write a message to the passed connection.

        """
        def fake_writer(connection, message):
            message["data"] = dict(message="Hello " + connection.user["_id"])
            connection.write_message(message)

        conn1 = mock_connection(dispatcher, username="Fred")
        conn2 = mock_connection(dispatcher, username="John")

        dispatcher.dispatch(fake_message, writer=fake_writer)

        assert conn1.messages[0]["data"]["message"] == "Hello Fred"
        assert conn2.messages[0]["data"]["message"] == "Hello John"
