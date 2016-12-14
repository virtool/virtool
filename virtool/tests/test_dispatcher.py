import json
import pytest

from virtool.dispatcher import Dispatcher


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


class TestInit:

    def test_ping(self, dispatcher):

        callback = dispatcher.add_periodic_callback

        assert callback.was_called
        assert callback.with_args[0].__name__ == "ping"
        assert callback.with_args[1] == 10000


class TestInterfaces:

    def test_add(self, recwarn, empty_dispatcher, mock_interface, mock_settings):
        # Add and interface that has a method decorated with exposed_method.
        empty_dispatcher.add_interface("test", mock_interface, mock_settings)

        # Make sure the 'no exposed methods' warning was not raised.
        assert len(recwarn) == 0

    def test_add_empty(self, recwarn, empty_dispatcher, empty_interface, mock_settings):
        # Make sure warning is raised if no exposed methods are found in interface object.
        with pytest.warns(Warning):
            empty_dispatcher.add_interface("test", empty_interface, mock_settings)

        # Double check that ONE warning was raised.
        assert len(recwarn) == 1

    def test_add_existing(self, dispatcher, mock_interface, mock_settings):
        with pytest.raises(ValueError) as inst:
            dispatcher.add_interface("test", mock_interface, mock_settings)

    def test_collection(self, dispatcher, mock_interface, mock_settings):
        assert "test" not in dispatcher.collections

        dispatcher.add_interface("coll", mock_interface, mock_settings, is_collection=True)

        assert "coll" in dispatcher.collections


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

    def test_dispatch_authorized(self, dispatcher, mock_connection):
        """
        Test the both of two AUTHORIZED connections can have messages dispatched through them using their
        ``write_message`` methods.

        """
        conn1 = mock_connection(dispatcher)
        conn2 = mock_connection(dispatcher)

        message = {
            "operation": "test",
            "collection_name": "test",
            "data": dict(message="This is a test")
        }

        dispatcher.dispatch(message)

        assert conn1.messages[0] == message
        assert conn2.messages[0] == message

    def test_dispatch_unauthorized(self, dispatcher, mock_connection):
        """
        Test the neither of two unauthorized connections have their ``write_message`` methods called during a dispatch.

        """
        conn1 = mock_connection(dispatcher, authorized=False)
        conn2 = mock_connection(dispatcher, authorized=False)

        conn1.open()
        conn2.open()

        dispatcher.dispatch({
            "operation": "test",
            "collection_name": "test",
            "data": dict(message="This is a test")
        })

        assert conn1.messages == []
        assert conn2.messages == []

    def test_dispatch_either(self, dispatcher, mock_connection):
        """
        Test the only the authorized connection has its ``write_message`` method called when an one authorized and one
        unauthorized connection are managed by the dispatcher.

        """
        conn1 = mock_connection(dispatcher, authorized=False)
        conn2 = mock_connection(dispatcher, authorized=True)

        message = {
            "operation": "test",
            "collection_name": "test",
            "data": dict(message="Only connection 2 should see this")
        }

        dispatcher.dispatch(message)

        assert conn1.messages == []
        assert conn2.messages == [message]

    def test_dispatch_specific(self, dispatcher, mock_connection):
        """
        Test that only the connection passed in the keyword argument ``connections`` has its ``write_message``
        method called when a dispatch occurs.

        """
        conn1 = mock_connection(dispatcher)
        conn2 = mock_connection(dispatcher)

        conn1.open()
        conn2.open()

        message = {
            "operation": "test",
            "collection_name": "test",
            "data": dict(message="This is a test")
        }

        dispatcher.dispatch(message, connections=[conn2])

        assert conn1.messages == []
        assert conn2.messages[0] == message


class TestHandle:

    @pytest.mark.gen_test
    def test_unknown_interface(self, caplog, dispatcher, mock_connection):
        """
        Test that a warning is logged when an unknown dispatcher interface is requested.

        """
        conn = mock_connection(dispatcher, permissions="all")

        code = yield dispatcher.handle(json.dumps({
            "tid": 9029401982,
            "interface": "foo",
            "method": "test_exposed_method",
            "data": {
                "value": "foobar"
            }
        }), conn)

        assert not code

        last_message = list(caplog.records)[-1].message

        assert last_message == "User 'test' requested unknown interface foo"

    @pytest.mark.gen_test
    def test_unknown_method(self, caplog, dispatcher, mock_connection):
        """
        Test that a warning is logged when an unknown interface method is requested.

        """
        conn = mock_connection(dispatcher)

        code = yield dispatcher.handle(json.dumps({
            "tid": 9029401982,
            "interface": "test",
            "method": "non_existent_method",
            "data": {
                "value": "foobar"
            }
        }), conn)

        assert not code

        last_message = list(caplog.records)[-1].message

        assert last_message == "User 'test' requested unknown interface method test.non_existent_method"

    @pytest.mark.gen_test
    def test_unexposed_method(self, caplog, dispatcher, mock_connection):
        """
        Test that a warning is logged when an unknown exposed method is requested.

        """
        conn = mock_connection(dispatcher)

        code = yield dispatcher.handle(json.dumps({
            "tid": 9029401983,
            "interface": "test",
            "method": "test_unexposed_method",
            "data": {
                "value": "foobar"
            }
        }), conn)

        assert not code

        last_message = list(caplog.records)[-1].message

        assert last_message == "User 'test' attempted to call unexposed method test.test_unexposed_method"

    @pytest.mark.gen_test
    def test_unauthorized(self, caplog, dispatcher, mock_connection):
        """
        Test that a warning is logged when an protected exposed method is requested by an unauthorized connection.

        """
        conn = mock_connection(dispatcher, authorized=False)

        code = yield dispatcher.handle(json.dumps({
            "tid": 9029401983,
            "interface": "test",
            "method": "test_exposed_method",
            "data": {
                "value": "foobar"
            }
        }), conn)

        assert not code

        last_message = list(caplog.records)[-1].message

        assert last_message == "Unauthorized connection at 8.8.8.8 attempted to call" \
                               " protected method test.test_exposed_method"

    @pytest.mark.gen_test
    def test_unprotected(self, dispatcher, mock_connection):
        """
        Test that unauthorized connections can successfully call unprotected methods.

        """
        conn = mock_connection(dispatcher, authorized=False)

        code = yield dispatcher.handle(json.dumps({
            "tid": 9029401983,
            "interface": "test",
            "method": "test_unprotected_method",
            "data": {
                "value": "foobar"
            }
        }), conn)

        assert code

        message_interfaces = [message["collection_name"] for message in conn.messages]

        assert "transaction" in message_interfaces
        assert "test" not in message_interfaces

    @pytest.mark.gen_test
    def test_authorized(self, dispatcher, mock_connection):
        """
        Test that unauthorized connections can successfully call unprotected methods.

        """
        conn = mock_connection(dispatcher, authorized=True)

        code = yield dispatcher.handle(json.dumps({
            "tid": 9029401983,
            "interface": "test",
            "method": "test_exposed_method",
            "data": {
                "value": "foobar"
            }
        }), conn)

        assert code

        message_interfaces = [message["collection_name"] for message in conn.messages]

        assert "transaction" in message_interfaces
        assert "test" not in message_interfaces

    @pytest.mark.gen_test
    def test_not_permitted(self, caplog, dispatcher, mock_connection):
        """
        Test that unauthorized connections can successfully call unprotected methods.

        """
        conn = mock_connection(dispatcher, permissions=[], authorized=True)

        code = yield dispatcher.handle(json.dumps({
            "tid": 9029401983,
            "interface": "test",
            "method": "test_permissions_exposed_method",
            "data": {
                "value": "foobar"
            }
        }), conn)

        last_message = list(caplog.records)[-1].message

        assert not code

        assert last_message == "User test attempted to call exposed method test.test_permissions_exposed_method" \
                               " without the required permissions"

    @pytest.mark.gen_test
    def test_is_permitted(self, dispatcher, mock_connection):
        """
        Test that unauthorized connections can successfully call unprotected methods.

        """
        conn = mock_connection(dispatcher, permissions=["modify_options"], authorized=True)

        code = yield dispatcher.handle(json.dumps({
            "tid": 9029401983,
            "interface": "test",
            "method": "test_permissions_exposed_method",
            "data": {
                "value": "foobar"
            }
        }), conn)

        assert code

    @pytest.mark.gen_test
    def test_no_transaction(self, dispatcher, mock_connection):
        """
        Test that exposed methods with no transaction argument raise a TypeError.

        """
        conn = mock_connection(dispatcher, authorized=True)

        with pytest.raises(TypeError) as inst:
            yield dispatcher.handle(json.dumps({
                "tid": 9029401983,
                "interface": "test",
                "method": "test_no_transaction_method",
                "data": {
                    "value": "foobar"
                }
            }), conn)

    @pytest.mark.gen_test
    def test_unhandled_name_error(self, dispatcher, mock_connection):
        """
        Test that all the exception handling going on in ``handle`` does not prevent unexpected exceptions from being
        raised.

        """
        conn = mock_connection(dispatcher, authorized=True)

        with pytest.raises(NameError):
            yield dispatcher.handle(json.dumps({
                "tid": 9029401983,
                "interface": "test",
                "method": "test_name_error_method",
                "data": {
                    "value": "foobar"
                }
            }), conn)

    @pytest.mark.gen_test
    def test_unhandled_type_error(self, dispatcher, mock_connection):
        """
        Test that all the exception handling going on in ``handle`` does not prevent unexpected exceptions from being
        raised.

        """
        conn = mock_connection(dispatcher, authorized=True)

        with pytest.raises(TypeError):
            yield dispatcher.handle(json.dumps({
                "tid": 9029401983,
                "interface": "test",
                "method": "test_type_error_method",
                "data": {
                    "value": "foobar"
                }
            }), conn)


class TestPing:

    @pytest.mark.gen_test
    def test_ping(self, dispatcher, mock_connection):
        conn1 = mock_connection(dispatcher, authorized=True)
        conn2 = mock_connection(dispatcher, authorized=False)

        yield dispatcher.ping()

        print(conn1.messages)

        assert conn1.messages[0]["operation"] == "ping"
        assert conn2.messages == []
